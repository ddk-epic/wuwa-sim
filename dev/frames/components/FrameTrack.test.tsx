// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render } from "@testing-library/react"
import {
  FrameTrack,
  TrackMarker,
  TrackRegion,
  frameAtClientX,
  frameToPct,
} from "./FrameTrack"

afterEach(cleanup)

// jsdom ships no Pointer Capture API; define a no-op so spies can replace it.
Element.prototype.setPointerCapture = () => {}

const rect = (left: number, width: number) => ({ left, width }) as DOMRect

describe("frameToPct", () => {
  it("maps lo→0, hi→100, midpoint→50", () => {
    expect(frameToPct(100, 100, 300)).toBe(0)
    expect(frameToPct(300, 100, 300)).toBe(100)
    expect(frameToPct(200, 100, 300)).toBe(50)
  })

  it("floors the span at 1 so a zero-width track never divides by zero", () => {
    expect(Number.isFinite(frameToPct(50, 50, 50))).toBe(true)
  })
})

describe("frameAtClientX", () => {
  it("rounds the pixel offset to the nearest frame", () => {
    // 200px box over [0,100]: each frame is 2px; 51px → 25.5 → 26.
    expect(frameAtClientX(51, rect(0, 200), 0, 100)).toBe(26)
  })

  it("clamps outside the box to the endpoints", () => {
    expect(frameAtClientX(-40, rect(0, 200), 0, 100)).toBe(0)
    expect(frameAtClientX(999, rect(0, 200), 0, 100)).toBe(100)
  })

  it("honours a non-zero lo and the box's left offset", () => {
    expect(frameAtClientX(100, rect(50, 200), 10, 110)).toBe(35)
  })
})

describe("TrackMarker / TrackRegion placement", () => {
  it("places a marker and a region by frame, not pixels", () => {
    const { container } = render(
      <FrameTrack lo={0} hi={200}>
        <TrackMarker frame={50} title="mark" />
        <TrackRegion start={50} end={150} className="region" />
      </FrameTrack>,
    )
    const marker = container.querySelector('[title="mark"]') as HTMLElement
    expect(marker.style.left).toBe("25%")
    const region = container.querySelector(".region") as HTMLElement
    expect(region.style.left).toBe("25%")
    expect(region.style.width).toBe("50%")
  })
})

describe("TrackMarker drag vs select", () => {
  it("a marker with onSelect but no onDrag selects without capturing the pointer", () => {
    const onSelect = vi.fn()
    const capture = vi
      .spyOn(Element.prototype, "setPointerCapture")
      .mockImplementation(() => {})
    const { container } = render(
      <FrameTrack lo={0} hi={100}>
        <TrackMarker frame={10} onSelect={onSelect} title="m" />
      </FrameTrack>,
    )
    fireEvent.pointerDown(container.querySelector('[title="m"]')!)
    expect(onSelect).toHaveBeenCalledOnce()
    expect(capture).not.toHaveBeenCalled()
    capture.mockRestore()
  })

  it("a draggable marker captures the pointer and reports a frame on move", () => {
    const onDrag = vi.fn()
    vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(
      () => {},
    )
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
      rect(0, 200),
    )
    const { container } = render(
      <FrameTrack lo={0} hi={100}>
        <TrackMarker frame={10} onDrag={onDrag} title="m" />
      </FrameTrack>,
    )
    const marker = container.querySelector('[title="m"]')!
    fireEvent.pointerDown(marker)
    fireEvent.pointerMove(marker, { buttons: 1, clientX: 100 })
    expect(onDrag).toHaveBeenCalledWith(50)
    vi.restoreAllMocks()
  })
})

describe("TrackMarker onDrag / onCommit split", () => {
  it("fires onDrag per move and onCommit once on release, tracking the cursor while dragging", () => {
    const onDrag = vi.fn()
    const onCommit = vi.fn()
    vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(
      () => {},
    )
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
      rect(0, 200),
    )
    const { container } = render(
      <FrameTrack lo={0} hi={100}>
        <TrackMarker frame={10} onDrag={onDrag} onCommit={onCommit} title="m" />
      </FrameTrack>,
    )
    const marker = container.querySelector('[title="m"]') as HTMLElement
    fireEvent.pointerDown(marker)
    fireEvent.pointerMove(marker, { buttons: 1, clientX: 100 })
    fireEvent.pointerMove(marker, { buttons: 1, clientX: 120 })
    expect(onDrag).toHaveBeenCalledTimes(2)
    expect(onDrag).toHaveBeenLastCalledWith(60)
    expect(onCommit).not.toHaveBeenCalled()
    expect(marker.style.left).toBe("60%")

    fireEvent.lostPointerCapture(marker)
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith(60)
    expect(marker.style.left).toBe("10%")
    vi.restoreAllMocks()
  })

  it("a marker with only onCommit is draggable and commits the released frame", () => {
    const onCommit = vi.fn()
    vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(
      () => {},
    )
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
      rect(0, 200),
    )
    const { container } = render(
      <FrameTrack lo={0} hi={100}>
        <TrackMarker frame={10} onCommit={onCommit} title="m" />
      </FrameTrack>,
    )
    const marker = container.querySelector('[title="m"]')!
    fireEvent.pointerDown(marker)
    fireEvent.pointerMove(marker, { buttons: 1, clientX: 100 })
    fireEvent.lostPointerCapture(marker)
    expect(onCommit).toHaveBeenCalledOnce()
    expect(onCommit).toHaveBeenCalledWith(50)
    vi.restoreAllMocks()
  })
})

describe("FrameTrack scrub", () => {
  it("seeks on pointer down through the rounded, clamped mapping", () => {
    const onScrub = vi.fn()
    vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(
      () => {},
    )
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
      rect(0, 200),
    )
    const { container } = render(
      <FrameTrack lo={0} hi={100} onScrub={onScrub}>
        <TrackRegion start={0} end={100} className="h-full w-full" />
      </FrameTrack>,
    )
    fireEvent.pointerDown(container.firstChild!, { clientX: 40 })
    expect(onScrub).toHaveBeenCalledWith(20)
    vi.restoreAllMocks()
  })
})
