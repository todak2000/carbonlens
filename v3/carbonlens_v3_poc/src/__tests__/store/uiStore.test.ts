/**
 * uiStore.test.ts
 *
 * Tests for the UIStore Zustand store — focusing on actions added for Phase 4
 * (demoActive flag) and verifying the overall store contract.
 *
 * We test state transitions directly via store actions without rendering any
 * React components (pure state-machine tests).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '../../store/uiStore'

// Reset store before each test so mutations don't bleed between tests
beforeEach(() => {
  useUIStore.setState({
    demoActive: false,
    sidebarOpen: true,
    activePanel: 'overview',
    view: 'landing',
    show3D: true,
    showGridView: true,
    showStressField: false,
    showPressureField: true,
    unitSystem: 'metric',
    warningCount: 0,
    blowoutActive: false,
    timestep: 1,
    projectYears: 50,
  })
})

// ── demoActive flag ───────────────────────────────────────────────────────────

describe('demoActive', () => {
  it('initial value is false', () => {
    expect(useUIStore.getState().demoActive).toBe(false)
  })

  it('setDemoActive(true) sets demoActive to true', () => {
    useUIStore.getState().setDemoActive(true)
    expect(useUIStore.getState().demoActive).toBe(true)
  })

  it('setDemoActive(false) sets demoActive back to false', () => {
    useUIStore.getState().setDemoActive(true)
    useUIStore.getState().setDemoActive(false)
    expect(useUIStore.getState().demoActive).toBe(false)
  })

  it('toggling demoActive twice returns to original state', () => {
    const initial = useUIStore.getState().demoActive
    useUIStore.getState().setDemoActive(true)
    useUIStore.getState().setDemoActive(false)
    expect(useUIStore.getState().demoActive).toBe(initial)
  })

  it('demoActive changes do not affect other state fields', () => {
    const before = useUIStore.getState()
    useUIStore.getState().setDemoActive(true)
    const after = useUIStore.getState()

    expect(after.activePanel).toBe(before.activePanel)
    expect(after.sidebarOpen).toBe(before.sidebarOpen)
    expect(after.view).toBe(before.view)
    expect(after.unitSystem).toBe(before.unitSystem)
  })
})

// ── View transitions ──────────────────────────────────────────────────────────

describe('view transitions', () => {
  it('initial view is landing', () => {
    expect(useUIStore.getState().view).toBe('landing')
  })

  it('setView changes the view', () => {
    useUIStore.getState().setView('workspace')
    expect(useUIStore.getState().view).toBe('workspace')
  })

  it('setView to dashboard works', () => {
    useUIStore.getState().setView('dashboard')
    expect(useUIStore.getState().view).toBe('dashboard')
  })
})

// ── Panel management ──────────────────────────────────────────────────────────

describe('panel management', () => {
  it('default panel is overview', () => {
    expect(useUIStore.getState().activePanel).toBe('overview')
  })

  it('setPanel changes activePanel', () => {
    useUIStore.getState().setPanel('formation')
    expect(useUIStore.getState().activePanel).toBe('formation')
  })

  it('setPanel to methodology works', () => {
    useUIStore.getState().setPanel('methodology')
    expect(useUIStore.getState().activePanel).toBe('methodology')
  })
})

// ── Sidebar ───────────────────────────────────────────────────────────────────

describe('sidebar', () => {
  it('initial sidebarOpen is true', () => {
    expect(useUIStore.getState().sidebarOpen).toBe(true)
  })

  it('setSidebar(false) closes sidebar', () => {
    useUIStore.getState().setSidebar(false)
    expect(useUIStore.getState().sidebarOpen).toBe(false)
  })

  it('setSidebar(true) reopens sidebar', () => {
    useUIStore.getState().setSidebar(false)
    useUIStore.getState().setSidebar(true)
    expect(useUIStore.getState().sidebarOpen).toBe(true)
  })
})

// ── Grid view toggle ──────────────────────────────────────────────────────────

describe('grid view toggle', () => {
  it('initial showGridView is true', () => {
    expect(useUIStore.getState().showGridView).toBe(true)
  })

  it('toggleGridView flips showGridView', () => {
    useUIStore.getState().toggleGridView()
    expect(useUIStore.getState().showGridView).toBe(false)
  })

  it('toggleGridView twice returns to original', () => {
    useUIStore.getState().toggleGridView()
    useUIStore.getState().toggleGridView()
    expect(useUIStore.getState().showGridView).toBe(true)
  })
})

// ── Units ─────────────────────────────────────────────────────────────────────

describe('unit system', () => {
  it('initial unit system is metric', () => {
    expect(useUIStore.getState().unitSystem).toBe('metric')
  })

  it('toggleUnits switches to imperial', () => {
    useUIStore.getState().toggleUnits()
    expect(useUIStore.getState().unitSystem).toBe('imperial')
  })

  it('toggleUnits twice returns to metric', () => {
    useUIStore.getState().toggleUnits()
    useUIStore.getState().toggleUnits()
    expect(useUIStore.getState().unitSystem).toBe('metric')
  })
})

// ── Project years ─────────────────────────────────────────────────────────────

describe('project years', () => {
  it('initial projectYears is 50', () => {
    expect(useUIStore.getState().projectYears).toBe(50)
  })

  it('setProjectYears updates the value', () => {
    useUIStore.getState().setProjectYears(30)
    expect(useUIStore.getState().projectYears).toBe(30)
  })

  it('setProjectYears to 100 years works', () => {
    useUIStore.getState().setProjectYears(100)
    expect(useUIStore.getState().projectYears).toBe(100)
  })
})

// ── 3D toggle ─────────────────────────────────────────────────────────────────

describe('3D visibility', () => {
  it('show3D is true by default', () => {
    expect(useUIStore.getState().show3D).toBe(true)
  })

  it('toggle3D flips show3D', () => {
    useUIStore.getState().toggle3D()
    expect(useUIStore.getState().show3D).toBe(false)
  })
})

// ── Warning / blowout ─────────────────────────────────────────────────────────

describe('warning and blowout', () => {
  it('warningCount starts at 0', () => {
    expect(useUIStore.getState().warningCount).toBe(0)
  })

  it('incrementWarning increases count', () => {
    useUIStore.getState().incrementWarning()
    useUIStore.getState().incrementWarning()
    expect(useUIStore.getState().warningCount).toBe(2)
  })

  it('blowoutActive starts false', () => {
    expect(useUIStore.getState().blowoutActive).toBe(false)
  })

  it('setBlowout(true) activates blowout', () => {
    useUIStore.getState().setBlowout(true)
    expect(useUIStore.getState().blowoutActive).toBe(true)
  })

  it('setBlowout(false) deactivates blowout', () => {
    useUIStore.getState().setBlowout(true)
    useUIStore.getState().setBlowout(false)
    expect(useUIStore.getState().blowoutActive).toBe(false)
  })
})

// ── Timestep ──────────────────────────────────────────────────────────────────

describe('timestep', () => {
  it('initial timestep is 1', () => {
    expect(useUIStore.getState().timestep).toBe(1)
  })

  it('setTimestep updates the value', () => {
    useUIStore.getState().setTimestep(5)
    expect(useUIStore.getState().timestep).toBe(5)
  })
})
