import { useHistory } from '../src/okahistory'

describe('useHistory', () => {
  function setup() {
    const target = useHistory()
    const state = { value: 0 }

    target.registReducer('ope_a', {
      undo(before: number) {
        state.value = before
      },
      redo(after: number) {
        const before = state.value
        state.value = after
        return before
      },
    })

    return {
      target,
      state,
    }
  }

  it('should throw if unknown action is called', () => {
    const { target } = setup()
    expect(() =>
      target.execAction({
        name: 'unknown',
        args: 10,
      })
    ).toThrow('not found the action: unknown')
  })

  it('should save actions', () => {
    const { target, state } = setup()

    target.execAction({
      name: 'ope_a',
      args: 10,
    })
    expect(state.value).toBe(10)

    target.execAction({
      name: 'ope_a',
      args: 20,
    })
    expect(state.value).toBe(20)
  })

  describe('undo & redo', () => {
    it('should undo & redo', () => {
      const { target, state } = setup()

      target.execAction({
        name: 'ope_a',
        args: 10,
      })
      target.execAction({
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

      target.execAction({
        name: 'ope_a',
        args: 10,
      })
      target.execAction({
        name: 'ope_a',
        args: 20,
      })
      expect(state.value).toBe(20)
      target.undo()
      expect(state.value).toBe(10)
      target.execAction({
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
})
