import type { HistoryModuleOptions } from '../src/okahistory'
import { useHistory } from '../src/okahistory'

describe('useHistory', () => {
  function setup(options: HistoryModuleOptions = {}) {
    const onUpdated = jest.fn()
    const target = useHistory({ onUpdated, ...options })
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
      onUpdated,
    }
  }

  describe('defineReducers', () => {
    it('should define reducers and return a fucntion to dispatch them', () => {
      const target = useHistory()
      const state = { value: 0, value2: '0' }

      type Reducers = {
        opeA: {
          redo: (val: number) => number
          undo: (val: number) => void
        }
        opeB: {
          redo: (val: string) => { value: number; value2: string }
          undo: (val: { value: number; value2: string }) => void
        }
      }

      const opeA: Reducers['opeA'] = {
        redo(after: number) {
          const before = state.value
          state.value = after
          return before
        },
        undo(before: number) {
          state.value = before
        },
      }
      const opeB: Reducers['opeB'] = {
        redo(after: string) {
          const before = { ...state }
          state.value2 = after
          return before
        },
        undo(before) {
          state.value2 = before.value2
        },
      }
      const { dispatch, createAction } = target.defineReducers({
        opeA,
        opeB,
      })

      dispatch(createAction('opeA', 10))
      expect(state).toEqual({ value: 10, value2: '0' })
      dispatch(createAction('opeB', '20'), [createAction('opeA', 20)])
      expect(state).toEqual({ value: 20, value2: '20' })
    })
  })

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
      const { target, state, onUpdated } = setup()

      target.dispatch({
        name: 'ope_a',
        args: 10,
      })
      expect(state.value).toBe(10)
      expect(onUpdated).toHaveReturnedTimes(1)

      target.dispatch({
        name: 'ope_a',
        args: 20,
      })
      expect(state.value).toBe(20)
      expect(onUpdated).toHaveReturnedTimes(2)
    })

    it('should dispatch with child actions', () => {
      const { target, state } = setup()

      target.dispatch({ name: 'ope_a', args: 10 }, [
        { name: 'ope_b', args: 20 },
        { name: 'ope_b', args: 30 },
      ])
      expect(state).toEqual({ value: 10, value2: 30 })
      expect(target.getActionSummaries()).toHaveLength(1)
      target.undo()
      expect(state).toEqual({ value: 0, value2: 0 })
      target.redo()
      expect(state).toEqual({ value: 10, value2: 30 })
    })

    describe('option: max', () => {
      it('should drop old history if the stack length is larger than max of the option', () => {
        const { target, state } = setup({ max: 2 })
        target.dispatch({ name: 'ope_a', args: 1 })
        expect(target.getActionSummaries()).toEqual([
          { name: 'ope_a', label: 'ope_a', done: true },
        ])
        target.dispatch({ name: 'ope_a', args: 2 })
        expect(target.getActionSummaries()).toEqual([
          { name: 'ope_a', label: 'ope_a', done: true },
          { name: 'ope_a', label: 'ope_a', done: true },
        ])
        target.dispatch({ name: 'ope_a', args: 3 })
        expect(target.getActionSummaries()).toEqual([
          { name: 'ope_a', label: 'ope_a', done: true },
          { name: 'ope_a', label: 'ope_a', done: true },
        ])
        target.undo()
        expect(state.value).toBe(2)
        target.undo()
        expect(state.value).toBe(1)
        target.undo()
        expect(state.value).toBe(1)
      })
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

      it('replace the last item having the seriesKey and child actions', () => {
        const { target, state } = setup()

        target.dispatch(
          {
            name: 'ope_a',
            args: 10,
            seriesKey: 'a',
          },
          [{ name: 'ope_b', args: 100 }]
        )
        expect(state).toEqual({ value: 10, value2: 100 })

        target.dispatch(
          {
            name: 'ope_a',
            args: 20,
            seriesKey: 'a',
          },
          [{ name: 'ope_b', args: 200 }]
        )
        expect(state).toEqual({ value: 20, value2: 200 })

        target.undo()
        expect(state).toEqual({ value: 0, value2: 0 })

        target.redo()
        expect(state).toEqual({ value: 20, value2: 200 })
      })
    })
  })

  describe('undo & redo', () => {
    it('should undo & redo', () => {
      const { target, state, onUpdated } = setup()

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
      expect(onUpdated).toHaveReturnedTimes(2)
      target.undo()
      expect(state.value).toBe(10)
      expect(target.getCurrentIndex()).toBe(0)
      expect(onUpdated).toHaveReturnedTimes(3)
      target.undo()
      expect(state.value).toBe(0)
      expect(target.getCurrentIndex()).toBe(-1)
      expect(onUpdated).toHaveReturnedTimes(4)
      target.undo()
      expect(state.value).toBe(0)
      expect(target.getCurrentIndex()).toBe(-1)
      expect(onUpdated).toHaveReturnedTimes(4)
      target.redo()
      expect(state.value).toBe(10)
      expect(target.getCurrentIndex()).toBe(0)
      expect(onUpdated).toHaveReturnedTimes(5)
      target.redo()
      expect(state.value).toBe(20)
      expect(target.getCurrentIndex()).toBe(1)
      expect(onUpdated).toHaveReturnedTimes(6)
      target.redo()
      expect(state.value).toBe(20)
      expect(target.getCurrentIndex()).toBe(1)
      expect(onUpdated).toHaveReturnedTimes(6)
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

  describe('jump', () => {
    it('should jump to the index', () => {
      const { target, state, onUpdated } = setup()

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
      expect(onUpdated).toHaveReturnedTimes(2)

      target.jump(-1)
      expect(state.value).toBe(0)
      expect(target.getCurrentIndex()).toBe(-1)
      expect(onUpdated).toHaveReturnedTimes(3)

      target.jump(-1)
      target.jump(-2)
      expect(onUpdated).toHaveReturnedTimes(3)

      target.jump(1)
      expect(state.value).toBe(20)
      expect(target.getCurrentIndex()).toBe(1)
      expect(onUpdated).toHaveReturnedTimes(4)

      target.jump(1)
      target.jump(2)
      expect(onUpdated).toHaveReturnedTimes(4)

      target.jump(0)
      expect(state.value).toBe(10)
      expect(target.getCurrentIndex()).toBe(0)
      expect(onUpdated).toHaveReturnedTimes(5)

      target.jump(0)
      expect(onUpdated).toHaveReturnedTimes(5)
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
      const onUpdated = jest.fn()
      const another = useHistory({ onUpdated })

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
      expect(onUpdated).toHaveReturnedTimes(1)
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

  describe('ignoreDuplication', () => {
    const target = useHistory()
    const state = { value: 0 }

    target.defineReducer('ope_a', {
      undo(before: number) {
        state.value = before
      },
      redo(after: number) {
        const before = state.value
        state.value = after
        return before
      },
      ignoreDuplication: true,
      checkDuplicationFn: (a, b) => a === b,
    })

    target.dispatch({ name: 'ope_a', args: 1 })
    expect(target.getCurrentIndex()).toBe(0)
    target.dispatch({ name: 'ope_a', args: 2 })
    expect(target.getCurrentIndex()).toBe(1)
    target.dispatch({ name: 'ope_a', args: 2 })
    expect(target.getCurrentIndex()).toBe(1)
  })
})
