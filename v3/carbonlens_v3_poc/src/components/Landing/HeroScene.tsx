import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { co2DensitySpanWagner, co2ViscosityFenghour } from '../../engine'
import { FORMATION_PRESETS } from '../../data/formationPresets'

interface WellConfig { x: number; z: number; rate: number }
interface CycleConfig { presetIdx: number; projectYears: number; wells: WellConfig[] }

interface Metrics {
  name: string; location: string; description: string
  area: number; depth: number; thickness: number; geometryType: string
  stored: number; capacity: number
  plumeRadius: number; plumeHeight: number
  residualPct: number; dissolvedPct: number; mobilePct: number
  year: number; maxYear: number
  pressure: number; wellCount: number; rates: string
}

const FORMATION_SIX = [0, 1, 2, 3, 4, 7]

function e1(x: number): number {
  if (x <= 0) return 1e10
  if (x <= 1) return -0.5772156649 - Math.log(x) + x - x*x/4 + x*x*x/18 - x*x*x*x/96 + x*x*x*x*x/600
  const a1=2.334733,a2=0.250621,b1=3.330657,b2=1.681534
  return Math.exp(-x)*(x*x+a1*x+a2)/(x*x+b1*x+b2)
}

function pickCycle(prevIdx: number): CycleConfig {
  const avail = FORMATION_SIX.filter(i => i !== prevIdx)
  const idx = avail[Math.floor(Math.random() * avail.length)]
  const preset = FORMATION_PRESETS[idx]
  const p = preset.params
  const totalRate = 0.3 + (p.area * p.porosity * p.thickness) / 600
  const wellCount = 1 + Math.floor(Math.random() * Math.min(3, Math.ceil(totalRate / 0.4)))
  return {
    presetIdx: idx, projectYears: 25 + Math.floor(Math.random() * 41),
    wells: Array.from({ length: wellCount }, () => ({
      x: (Math.random() - 0.5) * 2.2, z: (Math.random() - 0.5) * 1.6,
      rate: totalRate / wellCount * (0.8 + Math.random() * 0.4),
    })),
  }
}

function computeMetrics(cfg: CycleConfig, progress: number): Metrics {
  const preset = FORMATION_PRESETS[cfg.presetIdx]
  const p = preset.params
  const year = progress * cfg.projectYears
  const rampUp = 2, rampDown = 5
  const totRate = cfg.wells.reduce((s,w)=>s+w.rate, 0)
  const yrFrac = year <= rampUp ? year/rampUp
    : year > cfg.projectYears-rampDown ? Math.max(0,(cfg.projectYears-year)/rampDown) : 1
  const cum = totRate * yrFrac * year
  const T_K = p.temperature + 273.15
  const rhoCO2 = co2DensitySpanWagner(T_K, p.pressure*1e6)
  const A = p.area * 1e6
  const totalPV = A * p.thickness * p.netToGross * p.porosity
  const capacity = totalPV * 0.02 * rhoCO2 / 1e9
  const fillFrac = Math.min(1, cum / Math.max(0.001, capacity))
  const visc = co2ViscosityFenghour(T_K, rhoCO2)
  const perm_m2 = p.permeability * 9.869e-16
  const ct = 1e-9
  const t_sec = year * 365.25 * 24 * 3600
  const alpha = perm_m2 / (p.porosity * visc * ct)
  const rw=0.1
  const Qi = totRate*1e9/(rhoCO2*365.25*24*3600)
  const u = rw*rw/(4*alpha*Math.max(t_sec, 1))
  const dP = Math.max(0, (Qi*visc)/(4*Math.PI*perm_m2*p.thickness)*e1(u))
  const P_t = p.pressure + Math.min(25, dP)
  const rp = 5 + progress*38; const dp = 2 + progress*20
  const plumeR = Math.sqrt(A/Math.PI)*0.3*Math.sqrt(Math.min(1, fillFrac))
  const plumeH = p.thickness*0.55*Math.min(1, Math.sqrt(fillFrac))
  return {
    name: preset.name, location: preset.location, description: preset.description,
    area: p.area, depth: p.depth, thickness: p.thickness,
    geometryType: p.geometryType ?? 'dome',
    stored: cum, capacity,
    plumeRadius: plumeR, plumeHeight: plumeH,
    residualPct: rp, dissolvedPct: dp, mobilePct: 100-rp-dp,
    year: Math.round(Math.min(year, cfg.projectYears)), maxYear: cfg.projectYears,
    pressure: P_t, wellCount: cfg.wells.length,
    rates: cfg.wells.map(w=>`${w.rate.toFixed(2)} Mt/yr`).join(', '),
  }
}

// ── Terrain-type geometry builders ────────────────────────────────────────────
const SEG_W = 36, SEG_D = 28

function getSurfaceY(x: number, z: number, baseY: number, seed: number, type: string): number {
  const s = (seed % 100) / 100
  let y = baseY
  switch (type) {
    case 'dome':
      y += Math.sin(x*2.5+z*1.8+s*3)*0.07 + Math.sin(x*5.0-z*3.2+s*5)*0.035
      y += Math.cos(x*1.2+z*4.0+s*7)*0.05 + Math.sin(x*8.0+z*6.0+s*2)*0.02
      break
    case 'anticline':
      y += Math.sin(x*2.0+s*2)*0.1 * Math.exp(-z*z*0.3)
      y += Math.sin(x*4.0+s*4)*0.03 + Math.cos(z*2.0+s*3)*0.02
      break
    case 'fault': {
      const fl = (s-0.5)*0.6
      const fo = 0.08 + s*0.06
      y += Math.sin(x*3.0+z*2.0+s*5)*0.04 + Math.sin(x*6.0-z*4.0+s*3)*0.025
      if (x > fl) y += fo*(1-Math.exp(-(x-fl)*2))
      break
    }
    case 'layered':
    default:
      y += Math.sin(x*3.0+s*4)*0.025 + Math.cos(z*3.0+s*7)*0.025
      y += Math.sin(x*6.0+z*5.0+s*2)*0.015
      break
  }
  y += x*0.05
  return y
}

function buildReservoirGeo(baseY: number, seed: number, type: string) {
  const W=3.8, D=2.6, H=0.6
  const positions: number[]=[], indices: number[]=[], colors: number[]=[]
  for (let j=0;j<=SEG_D;j++)
    for (let i=0;i<=SEG_W;i++) {
      const x=(i/SEG_W-0.5)*W, z=(j/SEG_D-0.5)*D
      const y=getSurfaceY(x,z,baseY,seed,type)
      const bot=y-H
      positions.push(x,y,z, x,bot,z)
      const df = (y-baseY+H/2)/H
      colors.push(0.18+df*0.22, 0.12+df*0.16, 0.04+df*0.08, 0.18+df*0.15, 0.12+df*0.11, 0.04+df*0.06)
    }
  const S=SEG_W+1
  for (let j=0;j<SEG_D;j++)
    for (let i=0;i<SEG_W;i++) {
      const t00=(j*S+i)*2,t10=t00+2,t01=(j+1)*S+i*2,t11=t01+2,b00=t00+1,b10=t10+1,b01=t01+1,b11=t11+1
      indices.push(t00,t10,t01, t10,t11,t01)
      indices.push(b00,b01,b10, b10,b01,b11)
      indices.push(t00,b00,t10, t10,b00,b10)
      indices.push(t00,t01,b00, b00,t01,b01)
    }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.setIndex(indices); geo.computeVertexNormals()
  return geo
}

function buildCaprockGeo(baseY: number, seed: number, type: string) {
  const W=3.9,D=2.7
  const positions: number[]=[], indices: number[]=[]
  for (let j=0;j<=SEG_D;j++)
    for (let i=0;i<=SEG_W;i++) {
      const x=(i/SEG_W-0.5)*W, z=(j/SEG_D-0.5)*D
      const y=getSurfaceY(x,z,baseY+0.01,seed,type)
      const bot=y-0.05
      positions.push(x,y,z, x,bot,z)
    }
  const S=SEG_W+1
  for (let j=0;j<SEG_D;j++)
    for (let i=0;i<SEG_W;i++) {
      const t00=(j*S+i)*2,t10=t00+2,t01=(j+1)*S+i*2,t11=t01+2
      const b00=t00+1,b10=t10+1,b01=t01+1,b11=t11+1
      indices.push(t00,t10,t01, t10,t11,t01)
      indices.push(b00,b01,b10, b10,b01,b11)
    }
  const geo=new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions,3))
  geo.setIndex(indices); geo.computeVertexNormals()
  return geo
}

export default function HeroScene() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [m, setM] = useState<Metrics | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    const W=container.clientWidth,H=container.clientHeight
    const camera = new THREE.PerspectiveCamera(28,W/H,0.1,50)
    camera.position.set(6.5,3.2,8)

    const renderer = new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true})
    renderer.setSize(W,H); renderer.setPixelRatio(Math.min(devicePixelRatio,2))
    renderer.setClearColor(0,0)
    renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.0
    container.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0x446688,0.5))
    const dl=new THREE.DirectionalLight(0xffffff,2.5); dl.position.set(8,12,6); scene.add(dl)
    const fl=new THREE.DirectionalLight(0x4488cc,0.6); fl.position.set(-4,2,-3); scene.add(fl)

    const grid=new THREE.GridHelper(8,20,0x003344,0x002233)
    grid.position.y=-1.3; scene.add(grid)

    // ── Formation group ──
    const resGroup=new THREE.Group(); scene.add(resGroup)
    let resMesh: THREE.Mesh, resColors: Float32Array

    // ── Plume indicator (central volume) ──
    const plumeGroup=new THREE.Group(); plumeGroup.position.set(0,-0.5,0); scene.add(plumeGroup)
    const plumeMat=new THREE.MeshPhysicalMaterial({
      color:0x00c4a0, transparent:true, opacity:0.2, roughness:0.1, emissive:0x00c4a0, emissiveIntensity:0.1,
    })
    const plume=new THREE.Mesh(new THREE.SphereGeometry(1,32,24), plumeMat)
    plume.scale.set(0.01,0.01,0.01); plumeGroup.add(plume)
    const glowMat=new THREE.MeshBasicMaterial({color:0x00c4a0, transparent:true, opacity:0.06, side:THREE.BackSide})
    const glow=new THREE.Mesh(new THREE.SphereGeometry(1.3,24,18), glowMat)
    glow.scale.set(0.01,0.01,0.01); plumeGroup.add(glow)

    // ── Brine displacement rings (one per well) ──
    const ringGroup = new THREE.Group(); scene.add(ringGroup)

    // ── Well group ──
    const wellGroup = new THREE.Group(); scene.add(wellGroup)

    // ── Particles ──
    const PCOUNT=300
    const pPos=new Float32Array(PCOUNT*3)
    const pVel:{x:number;y:number;z:number;spawned:boolean}[]=[]
    for(let i=0;i<PCOUNT;i++){pPos[i*3]=0;pPos[i*3+1]=-10;pPos[i*3+2]=0;pVel.push({x:0,y:0,z:0,spawned:false})}
    const pGeo=new THREE.BufferGeometry()
    pGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3))
    const pMat=new THREE.PointsMaterial({color:0x00eedd, transparent:true, opacity:0.5, size:0.03, blending:THREE.AdditiveBlending})
    scene.add(new THREE.Points(pGeo,pMat))

    function buildWells(wells: WellConfig[]) {
      while(wellGroup.children.length){const c=wellGroup.children[0];wellGroup.remove(c);if((c as THREE.Mesh).geometry)(c as THREE.Mesh).geometry.dispose()}
      while(ringGroup.children.length){const c=ringGroup.children[0];ringGroup.remove(c);if((c as THREE.Mesh).geometry)(c as THREE.Mesh).geometry.dispose()}
      for(const w of wells){
        const casing=new THREE.Mesh(
          new THREE.CylinderGeometry(0.015,0.02,1.1,6),
          new THREE.MeshPhysicalMaterial({color:0x607080, metalness:0.7, roughness:0.3})
        )
        casing.position.set(w.x,-0.75,w.z); wellGroup.add(casing)
        const head=new THREE.Mesh(
          new THREE.CylinderGeometry(0.035,0.028,0.035),
          new THREE.MeshPhysicalMaterial({color:0xcc3333, metalness:0.5, roughness:0.5})
        )
        head.position.set(w.x,-0.2,w.z); wellGroup.add(head)
        // Pulsing injection glow ring
        const glowRing=new THREE.Mesh(
          new THREE.RingGeometry(0.02,0.06,12),
          new THREE.MeshBasicMaterial({color:0x00ffcc, transparent:true, opacity:0, side:THREE.DoubleSide})
        )
        glowRing.position.set(w.x,-0.85,w.z); glowRing.rotation.x=-Math.PI/2
        wellGroup.add(glowRing)
        // Perforation glow sphere
        const perfGlow=new THREE.Mesh(
          new THREE.SphereGeometry(0.025,8,6),
          new THREE.MeshBasicMaterial({color:0x00ffdd, transparent:true, opacity:0})
        )
        perfGlow.position.set(w.x,-0.85,w.z); wellGroup.add(perfGlow)
        // Brine displacement ring for this well
        const brRing=new THREE.Mesh(
          new THREE.RingGeometry(0.3,0.35,32),
          new THREE.MeshBasicMaterial({color:0x4488bb, transparent:true, opacity:0, side:THREE.DoubleSide})
        )
        brRing.position.set(w.x,-0.65,w.z); brRing.rotation.x=-Math.PI/2
        ringGroup.add(brRing)
      }
    }

    // ── Cycle state ──
    let cycle=pickCycle(-1), progress=0, seed=0, visible=true, obTime=0, alive=true, spawnIdx=0

    function startCycle() {
      while(resGroup.children.length){const c=resGroup.children[0];resGroup.remove(c);(c as THREE.Mesh).geometry.dispose()}
      const preset=FORMATION_PRESETS[cycle.presetIdx]
      const type=preset.params.geometryType ?? 'dome'
      seed=Math.floor(Math.random()*100)
      const g1=buildReservoirGeo(-0.78,seed,type)
      resMesh=new THREE.Mesh(g1, new THREE.MeshPhysicalMaterial({
        color:0x8a7a5a, roughness:0.85, metalness:0, vertexColors:true, side:THREE.DoubleSide,
      }))
      resGroup.add(resMesh)
      resColors=resMesh.geometry.attributes.color.array as Float32Array

      const g2=buildCaprockGeo(-0.78,seed,type)
      const capMesh=new THREE.Mesh(g2, new THREE.MeshPhysicalMaterial({
        color:0x5a5a6a, roughness:0.9, metalness:0, transparent:true, opacity:0.55, side:THREE.DoubleSide,
      }))
      resGroup.add(capMesh)
      const edges=new THREE.LineSegments(
        new THREE.EdgesGeometry(g1),
        new THREE.LineBasicMaterial({color:0x8a7a5a, transparent:true, opacity:0.2})
      )
      resGroup.add(edges)

      buildWells(cycle.wells)
      progress=0
      plume.scale.set(0.01,0.01,0.01); glow.scale.set(0.01,0.01,0.01)
      plumeMat.opacity=0.2; glowMat.opacity=0.06
      for(const c of ringGroup.children){const m=c as THREE.Mesh;(m.material as THREE.Material).opacity=0;m.scale.set(1,1,1)}
      const pos=pGeo.attributes.position.array as Float32Array
      for(let i=0;i<PCOUNT;i++){pos[i*3]=0;pos[i*3+1]=-10;pos[i*3+2]=0;pVel[i].spawned=false}
      pGeo.attributes.position.needsUpdate=true; spawnIdx=0
      // Reset formation to brine colors
      for(let i=0;i<resColors.length;i+=3){
        resColors[i]=0.05; resColors[i+1]=0.2; resColors[i+2]=0.4 // brine blue
      }
      resMesh.geometry.attributes.color.needsUpdate=true

      setM(computeMetrics(cycle,0))
    }
    startCycle()

    function animate() {
      if(!alive) return
      requestAnimationFrame(animate)
      if(!visible){renderer.render(scene,camera);return}

      progress=Math.min(1,progress+1/(15*60))
      const fill=Math.min(1,progress)
      const m=computeMetrics(cycle,progress)

      // ── Two-phase vertex coloring (brine→CO2) ──
      const pos=resMesh.geometry.attributes.position.array as Float32Array
      const v=new THREE.Vector3()
      const pRadius3D=0.1+fill*1.3
      for(let i=0;i<resColors.length/3;i++){
        v.set(pos[i*3],pos[i*3+1],pos[i*3+2])
        let minD=Infinity
        for(const w of cycle.wells){
          const dx=v.x-w.x, dz=v.z-w.z
          minD=Math.min(minD,Math.sqrt(dx*dx+dz*dz))
        }
        const t=minD<pRadius3D ? 1 : minD<pRadius3D*2 ? 1-(minD-pRadius3D)/pRadius3D : 0
        resColors[i*3]=0.05*(1-t)+0.0*t       // brine blue → CO2 teal (R)
        resColors[i*3+1]=0.2*(1-t)+0.77*t      // G
        resColors[i*3+2]=0.4*(1-t)+0.63*t      // B
      }
      resMesh.geometry.attributes.color.needsUpdate=true

      // ── Central plume ──
      const sx=0.05+fill*1.1, sy=0.05+fill*0.45, sz=0.05+fill*0.7
      plume.scale.set(sx,sy,sz); glow.scale.set(sx*1.3,sy*1.3,sz*1.3)
      plumeMat.opacity=0.06+fill*0.2; glowMat.opacity=0.02+fill*0.06

      // ── Brine rings expand from each well ──
      for(let i=0;i<ringGroup.children.length;i++){
        const ring=ringGroup.children[i]as THREE.Mesh
        const rs=0.1+fill*2.5
        ring.scale.set(rs,rs,rs)
        const ringMat = ring.material as THREE.Material; ringMat.opacity=Math.min(0.15,0.03+fill*0.12)
      }

      // ── Well injection glow pulses ──
      const pulse=0.5+0.5*Math.sin(obTime*4)
      for(const child of wellGroup.children){
        const mesh=child as THREE.Mesh
        if(mesh.type!=='Mesh'||!mesh.material) continue
        const mat=mesh.material as THREE.MeshBasicMaterial
        if(!mat.type||mat.type==='MeshPhysicalMaterial') continue
        if(mesh.geometry.type==='RingGeometry'){
          mat.opacity=(0.15+fill*0.55)*pulse
          const s=0.02+fill*0.05*pulse
          mesh.scale.set(1+s,1+s,1)
        }
        if(mesh.geometry.type==='SphereGeometry'){
          mat.opacity=(0.2+fill*0.6)*pulse
          const s=0.025+fill*0.04*pulse
          mesh.scale.set(s/0.025,s/0.025,s/0.025)
        }
      }

      // ── Particles emit from wells ──
      const ppos=pGeo.attributes.position.array as Float32Array
      const spawnRate=Math.max(1,Math.floor(2+fill*3))
      for(let s=0;s<spawnRate&&spawnIdx<PCOUNT;s++){
        const wi=Math.floor(Math.random()*cycle.wells.length)
        const w=cycle.wells[wi]; const i=spawnIdx
        ppos[i*3]=w.x+(Math.random()-0.5)*0.1
        ppos[i*3+1]=-0.85+(Math.random()-0.5)*0.04
        ppos[i*3+2]=w.z+(Math.random()-0.5)*0.1
        pVel[i]={x:(Math.random()-0.5)*0.02, y:0.006+Math.random()*0.012, z:(Math.random()-0.5)*0.02, spawned:true}
        spawnIdx++
      }
      const spread=0.2+fill*1.2
      for(let i=0;i<PCOUNT;i++){
        if(!pVel[i].spawned) continue
        ppos[i*3]+=pVel[i].x; ppos[i*3+1]+=pVel[i].y; ppos[i*3+2]+=pVel[i].z
        pVel[i].x+=(Math.random()-0.5)*0.005; pVel[i].z+=(Math.random()-0.5)*0.005
        if(ppos[i*3+1]>-0.55+fill*0.3||Math.abs(ppos[i*3])>spread||Math.abs(ppos[i*3+2])>spread*0.7){
          ppos[i*3]=0; ppos[i*3+1]=-10; ppos[i*3+2]=0; pVel[i].spawned=false
        }
      }
      pGeo.attributes.position.needsUpdate=true
      pMat.size=0.015+fill*0.02; pMat.opacity=0.15+fill*0.4

      setM(m)

      if(progress>=1){cycle=pickCycle(cycle.presetIdx);startCycle()}

      obTime+=0.007
      const rad=7.5+Math.sin(obTime*0.1)*0.5
      camera.position.x=rad*Math.cos(obTime*0.12)
      camera.position.z=rad*Math.sin(obTime*0.12)
      camera.position.y=3+Math.sin(obTime*0.08)*0.5
      camera.lookAt(0,-0.3,0)
      renderer.render(scene,camera)
    }
    animate()

    const onResize=()=>{const w=container.clientWidth,h=container.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h)}
    const ro=new ResizeObserver(onResize); ro.observe(container)
    const iv=new IntersectionObserver(e=>{visible=e[0]?.isIntersecting??true},{threshold:0.1})
    iv.observe(container)

    return()=>{alive=false;ro.disconnect();iv.disconnect();renderer.dispose();container.removeChild(renderer.domElement)}
  },[])

  if(!m) return<div ref={containerRef} className="absolute inset-0"/>
  const fillPct=m.capacity>0.001?Math.min(100,m.stored/m.capacity*100):0

  return (
    <div ref={containerRef} className="absolute inset-0">
      <div className="absolute bottom-4 md:bottom-8 right-4 md:right-8 z-10 font-mono pointer-events-none max-w-[280px] w-full">
        <div className="bg-black/50 dark:bg-black/50 bg-white/80 backdrop-blur-sm border border-white/10 dark:border-white/10 border-black/10 rounded-xl px-4 py-3 space-y-1.5">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"/>
            <span className="text-xs md:text-sm font-bold dark:text-white/95 text-gray-900">{m.name}</span>
            <span className="text-[8px] font-mono text-white/40 dark:text-white/40 text-gray-500 uppercase ml-auto">{m.geometryType}</span>
          </div>
          <div className="text-[10px] md:text-xs dark:text-white/50 text-gray-600">{m.location}</div>
          <div className="text-[9px] md:text-[10px] dark:text-white/30 text-gray-500">{m.area} km² · {m.depth}m · {m.thickness}m</div>
          <div className="text-[9px] md:text-[10px] dark:text-white/25 text-gray-500 italic leading-tight line-clamp-2">{m.description}</div>

          <div className="h-px dark:bg-white/10 bg-black/10 my-1"/>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <div>
              <span className="text-[8px] md:text-[9px] dark:text-white/30 text-gray-500 uppercase tracking-wider">Year</span>
              <div className="text-[11px] md:text-xs dark:text-white/90 text-gray-800 font-semibold">{m.year}/{m.maxYear}</div>
            </div>
            <div>
              <span className="text-[8px] md:text-[9px] dark:text-white/30 text-gray-500 uppercase tracking-wider">Stored</span>
              <div className="text-[11px] md:text-xs text-emerald-500 font-semibold">{m.stored.toFixed(2)} Mt</div>
            </div>
            <div>
              <span className="text-[8px] md:text-[9px] dark:text-white/30 text-gray-500 uppercase tracking-wider">Capacity</span>
              <div className="text-[11px] md:text-xs text-emerald-500/80 font-semibold">{m.capacity.toFixed(1)} Mt</div>
            </div>
            <div>
              <span className="text-[8px] md:text-[9px] dark:text-white/30 text-gray-500 uppercase tracking-wider">Fill</span>
              <div className="flex items-center gap-1">
                <div className="flex-1 h-1.5 rounded-full dark:bg-white/10 bg-black/10 overflow-hidden">
                  <div style={{width:`${fillPct}%`}} className="h-full rounded-full bg-emerald-500/70 transition-all duration-300"/>
                </div>
                <span className="text-[10px] md:text-[11px] dark:text-white/60 text-gray-600 w-7 text-right">{fillPct.toFixed(0)}%</span>
              </div>
            </div>
            <div>
              <span className="text-[8px] md:text-[9px] dark:text-white/30 text-gray-500 uppercase tracking-wider">Plume</span>
              <div className="text-[11px] md:text-xs text-cyan-500 font-semibold">{Math.round(m.plumeRadius)}×{Math.round(m.plumeHeight)}m</div>
            </div>
            <div>
              <span className="text-[8px] md:text-[9px] dark:text-white/30 text-gray-500 uppercase tracking-wider">Pressure</span>
              <div className="text-[11px] md:text-xs text-amber-500 font-semibold">{m.pressure.toFixed(1)} MPa</div>
            </div>
          </div>

          <div className="h-px dark:bg-white/10 bg-black/10 my-1"/>

          <div className="flex items-center gap-1.5 text-[9px] md:text-[10px]">
            <span className="dark:text-white/30 text-gray-500 uppercase tracking-wider">Wells</span>
            <span className="text-violet-500 font-semibold">{m.wellCount}</span>
            <span className="dark:text-white/30 text-gray-400">·</span>
            <span className="dark:text-white/50 text-gray-600 text-[8px] md:text-[9px]">{m.rates}</span>
          </div>

          <div className="h-px dark:bg-white/10 bg-black/10 my-1"/>

          <div className="flex items-center gap-2 text-[9px] md:text-[10px]">
            <span className="dark:text-white/30 text-gray-500 uppercase tracking-wider">Trapping</span>
            <span className="text-amber-500/90">R{m.residualPct.toFixed(0)}</span>
            <span className="text-blue-500/90">D{m.dissolvedPct.toFixed(0)}</span>
            <span className="text-emerald-500/90">M{m.mobilePct.toFixed(0)}</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden dark:bg-white/10 bg-black/10 flex">
            <div style={{width:`${m.residualPct}%`}} className="bg-amber-500/70 h-full transition-all duration-200"/>
            <div style={{width:`${m.dissolvedPct}%`}} className="bg-blue-500/70 h-full transition-all duration-200"/>
            <div style={{width:`${m.mobilePct}%`}} className="bg-emerald-500/70 h-full transition-all duration-200"/>
          </div>
        </div>
      </div>
    </div>
  )
}
