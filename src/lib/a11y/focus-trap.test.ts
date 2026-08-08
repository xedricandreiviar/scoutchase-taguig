import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createFocusTrap, getFocusableElements } from './focus-trap'

describe('getFocusableElements', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.removeChild(container)
  })

  it('finds buttons, links, and inputs', () => {
    container.innerHTML = `
      <button>Click me</button>
      <a href="/test">Link</a>
      <input type="text" />
      <textarea></textarea>
      <select><option>opt</option></select>
    `
    const elements = getFocusableElements(container)
    expect(elements).toHaveLength(5)
  })

  it('excludes disabled elements', () => {
    container.innerHTML = `
      <button>Enabled</button>
      <button disabled>Disabled</button>
      <input type="text" disabled />
    `
    const elements = getFocusableElements(container)
    expect(elements).toHaveLength(1)
  })

  it('excludes elements with tabindex=-1', () => {
    container.innerHTML = `
      <button>Normal</button>
      <div tabindex="-1">Not focusable</div>
      <div tabindex="0">Focusable div</div>
    `
    const elements = getFocusableElements(container)
    expect(elements).toHaveLength(2)
  })

  it('returns empty array for container with no focusable elements', () => {
    container.innerHTML = `<p>Just text</p><div>More text</div>`
    const elements = getFocusableElements(container)
    expect(elements).toHaveLength(0)
  })
})

describe('createFocusTrap', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.removeChild(container)
  })

  it('focuses the first focusable element on creation', () => {
    container.innerHTML = `
      <button id="first">First</button>
      <button id="second">Second</button>
    `
    createFocusTrap(container)
    expect(document.activeElement).toBe(container.querySelector('#first'))
  })

  it('calls onEscape when Escape key is pressed', () => {
    container.innerHTML = `<button>Close</button>`
    const onEscape = vi.fn()
    createFocusTrap(container, { onEscape })

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    container.dispatchEvent(event)

    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  it('does not call onEscape for other keys', () => {
    container.innerHTML = `<button>Close</button>`
    const onEscape = vi.fn()
    createFocusTrap(container, { onEscape })

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    container.dispatchEvent(event)

    expect(onEscape).not.toHaveBeenCalled()
  })

  it('cleanup removes event listeners and restores focus', () => {
    const outsideButton = document.createElement('button')
    outsideButton.textContent = 'Outside'
    document.body.appendChild(outsideButton)
    outsideButton.focus()

    container.innerHTML = `<button>Inside</button>`
    const cleanup = createFocusTrap(container, { returnFocusTo: outsideButton })

    // Focus moved inside
    expect(document.activeElement).toBe(container.querySelector('button'))

    // Cleanup should restore focus
    cleanup()
    expect(document.activeElement).toBe(outsideButton)

    document.body.removeChild(outsideButton)
  })

  it('makes container focusable when no focusable elements exist', () => {
    container.innerHTML = `<p>No buttons here</p>`
    createFocusTrap(container)
    expect(container.getAttribute('tabindex')).toBe('-1')
    expect(document.activeElement).toBe(container)
  })

  it('focuses initialFocus element when provided', () => {
    container.innerHTML = `
      <button id="first">First</button>
      <button id="second">Second</button>
    `
    const secondBtn = container.querySelector('#second') as HTMLElement
    createFocusTrap(container, { initialFocus: secondBtn })
    expect(document.activeElement).toBe(secondBtn)
  })
})
