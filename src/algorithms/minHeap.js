/**
 * Binary min-heap keyed on numeric cost.
 *
 * Dijkstra's inner loop needs "pop the cheapest unsettled node, every
 * time". An array-backed heap gives O(log n) pop/push instead of the O(n)
 * a sorted array or a naive linear scan would cost. With ~30 nodes the
 * constant factor barely matters, but this is the textbook structure and
 * it scales if the sampling cap is ever raised.
 */
export class MinHeap {
  constructor() {
    /** @type {Array<{id:number,cost:number}>} */
    this.items = []
  }

  get size() {
    return this.items.length
  }

  push(id, cost) {
    this.items.push({ id, cost })
    let i = this.items.length - 1

    // Sift the new node up until its parent is no larger than it.
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.items[parent].cost <= this.items[i].cost) break
      const tmp = this.items[parent]
      this.items[parent] = this.items[i]
      this.items[i] = tmp
      i = parent
    }
  }

  /** Remove and return the cheapest node, or null when empty. */
  pop() {
    if (this.items.length === 0) return null

    const top = this.items[0]
    const last = this.items.pop()

    if (this.items.length > 0) {
      this.items[0] = last
      // Sift the replacement down into place.
      let i = 0
      for (;;) {
        const left = 2 * i + 1
        const right = left + 1
        let smallest = i

        if (left < this.items.length && this.items[left].cost < this.items[smallest].cost) {
          smallest = left
        }
        if (right < this.items.length && this.items[right].cost < this.items[smallest].cost) {
          smallest = right
        }
        if (smallest === i) break

        const tmp = this.items[smallest]
        this.items[smallest] = this.items[i]
        this.items[i] = tmp
        i = smallest
      }
    }
    return top
  }
}