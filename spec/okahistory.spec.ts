import { useHistory } from '../src/okahistory'

describe('useHistory', () => {
  function setup() {
    const target = useHistory()
    const state = { value: 0, value2: 0 }

    target.defineReducer('ope_a', {
      undo(before: number) {
        state.value = before
      },
      redo(after: number) {
        const before = state.value
        state.value = after
        return before
      },
    })

    target.defineReducer('ope_b', {
      undo(before: number) {
        state.value2 = before
      },
      redo(after: number) {
        const before = state.value2
        state.value2 = after
        return before
      },
      getLabel: (action) => `label_${action.name}`,
    })

    return {
      target,
      state,
    }
  }

  describe('dispatch', () => {
    it('should throw if unknown action is called', () => {
      const { target } = setup()
      expect(() =>
        target.dispatch({
          name: 'unknown',
          args: 10,
        })
      ).toThrow('not found a reducer for the action: unknown')
    })

    it('should save actions', () => {
      const { target, state } = setup()

      target.dispatch({
        name: 'ope_a',
        args: 10,
      })
      expect(state.value).toBe(10)

      target.dispatch({
        name: 'ope_a',
        args: 20,
      })
      expect(state.value).toBe(20)
    })

    describe('when the same seriesKey is passed', () => {
      it('replace the last item having the seriesKey', () => {
        const { target, state } = setup()

        target.dispatch({
          name: 'ope_a',
          args: 10,
          seriesKey: 'a',
        })
        target.dispatch({
          name: 'ope_b',
          args: 20,
        })
        target.dispatch({
          name: 'ope_a',
          args: 30,
          seriesKey: 'a',
        })

        expect(state.value).toBe(30)
        expect(state.value2).toBe(20)
        expect(target.getCurrentIndex()).toBe(1)
        target.undo()
        expect(state.value).toBe(0)
        expect(state.value2).toBe(20)
        target.undo()
        expect(state.value).toBe(0)
        expect(state.value2).toBe(0)
      })
    })
  })

  describe('undo & redo', () => {
    it('should undo & redo', () => {
      const { target, state } = setup()

      target.dispatch({
        name: 'ope_a',
        args: 10,
      })
      target.dispatch({
        name: 'ope_a',
        args: 20,
      })

      expect(state.value).toBe(20)
      expect(target.getCurrentIndex()).toBe(1)
      target.undo()
      expect(state.value).toBe(10)
      expect(target.getCurrentIndex()).toBe(0)
      target.undo()
      expect(state.value).toBe(0)
      expect(target.getCurrentIndex()).toBe(-1)
      target.undo()
      expect(state.value).toBe(0)
      expect(target.getCurrentIndex()).toBe(-1)
      target.redo()
      expect(state.value).toBe(10)
      expect(target.getCurrentIndex()).toBe(0)
      target.redo()
      expect(state.value).toBe(20)
      expect(target.getCurrentIndex()).toBe(1)
      target.redo()
      expect(state.value).toBe(20)
      expect(target.getCurrentIndex()).toBe(1)
    })

    it('should dispose redo branch if new action is pushed', () => {
      const { target, state } = setup()

      target.dispatch({
        name: 'ope_a',
        args: 10,
      })
      target.dispatch({
        name: 'ope_a',
        args: 20,
      })
      expect(state.value).toBe(20)
      target.undo()
      expect(state.value).toBe(10)
      target.dispatch({
        name: 'ope_a',
        args: 30,
      })
      expect(state.value).toBe(30)
      target.redo()
      expect(state.value).toBe(30)
      target.undo()
      expect(state.value).toBe(10)
      target.undo()
      expect(state.value).toBe(0)
      target.undo()
      expect(state.value).toBe(0)
    })
  })

  describe('getActionSummaries', () => {
    it('should return action summaries', () => {
      const { target } = setup()

      target.dispatch({
        name: 'ope_a',
        args: 10,
      })
      target.dispatch({
        name: 'ope_b',
        args: 20,
      })

      expect(target.getActionSummaries()).toEqual([
        { name: 'ope_a', label: 'ope_a', done: true },
        { name: 'ope_b', label: 'label_ope_b', done: true },
      ])

      target.undo()
      expect(target.getActionSummaries()).toEqual([
        { name: 'ope_a', label: 'ope_a', done: true },
        { name: 'ope_b', label: 'label_ope_b', done: false },
      ])
    })
  })

  describe('serialize & deserialize', () => {
    it('should serialize & deserialize the stack and the index', () => {
      const { target, state } = setup()

      target.dispatch({
        name: 'ope_a',
        args: 10,
      })
      target.dispatch({
        name: 'ope_a',
        args: 20,
      })
      target.undo()

      const data = target.serialize()
      const another = useHistory()

      another.defineReducer('ope_a', {
        undo(before: number) {
          state.value = before
        },
        redo(after: number) {
          const before = state.value
          state.value = after
          return before
        },
      })

      another.deserialize(data)
      expect(another.getCurrentIndex()).toBe(0)
      another.undo()
      expect(state.value).toBe(0)
      another.redo()
      expect(state.value).toBe(10)
      another.redo()
      expect(state.value).toBe(20)
    })
  })

  describe('clear', () => {
    it('should clear all state', () => {
      const { target } = setup()
      target.dispatch({
        name: 'ope_a',
        args: 20,
      })
      expect(target.getCurrentIndex()).toBe(0)
      target.clear()
      expect(target.getCurrentIndex()).toBe(-1)
    })
  })
})
