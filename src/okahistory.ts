export type ActionName = string

export interface Action<RedoArgs> {
  /**
   * Unique name of this action.
   * This value may be serialized.
   */
  name: ActionName
  /**
   * Args to exec redo operation of this action.
   */
  args: RedoArgs
  /**
   * The actions having the same seriesKey are treated as the same series.
   * When new action having seriesKey is added,
   * old actions having the same seriesKey are removed
   * and the new action inherits the first undoArgs.
   * e.g.
   *   when
   *   0: redo, a = 1,  undo: a = 0, seriesKey = 'a'
   *   1: redo, b = 10, undo: b = 0
   *   add new action
   *   redo: a = 2, seriesKey = 'a'
   *   then
   *   0: redo: b = 10, undo: b = 0
   *   1: redo: a = 2,  undo: a = 0, seriesKey = 'a'
   */
  seriesKey?: string
}

export interface Reducer<RedoArgs, UndoArgs> {
  /**
   * should return args to exec undo operation.
   * e.g. snapshot of the state
   */
  redo(redoState: RedoArgs): UndoArgs
  undo(undoState: UndoArgs): void
  /**
   * should return a label of ActionSummary for target action.
   * if this prop is omitted, action's name is used.
   */
  getLabel?: (action: Action<RedoArgs>) => string
  /**
   * if this value is true, ignore the same action dispatched one after another
   * default: false
   */
  ignoreDuplication?: boolean
  /**
   * check whether two actions are same to ignore duplication (see ignoreDuplication)
   * default: (a, b) => a === b
   */
  checkDuplicationFn?: (a: RedoArgs, b: RedoArgs) => boolean
}

export interface SavedAction<RedoArgs, UndoArgs> {
  name: ActionName
  redoArgs: RedoArgs
  undoArgs: UndoArgs
  seriesKey?: string
  children?: SavedAction<unknown, unknown>[]
}

interface SerializedState {
  version: '0' // independent on the version in package.json
  stack: SavedAction<any, any>[]
  currentStackIndex: number
}

interface ActionSummary {
  name: ActionName
  label: string
  done: boolean
}

interface HistoryModule {
  defineReducer<UndoArgs, RedoArgs>(
    name: ActionName,
    reducer: Reducer<RedoArgs, UndoArgs>
  ): void
  defineReducers<T extends { [name: ActionName]: Reducer<any, any> }>(
    reducers: T
  ): {
    dispatch: <K extends keyof T>(
      action: {
        name: K
        args: Parameters<T[K]['redo']>[0]
      },
      children?: {
        name: K
        args: Parameters<T[K]['redo']>[0]
      }[]
    ) => void
    createAction: <K extends keyof T>(
      name: K,
      args: Parameters<T[K]['redo']>[0]
    ) => { name: K; args: Parameters<T[K]['redo']>[0] }
  }
  dispatch<RedoArgs>(
    action: Action<RedoArgs>,
    children?: Action<unknown>[]
  ): void
  redo(): void
  undo(): void
  /**
   * jump to the index
   * -1 is the oldest index
   */
  jump(index: number): void
  getCurrentIndex(): number
  getActionSummaries(): ActionSummary[]
  serialize(): SerializedState
  deserialize(state: SerializedState): void
  clear(): void
}

export interface HistoryModuleOptions {
  /**
   * max history length
   * default: 64
   */
  max?: number
  /**
   * call this func after the history stack is updated
   */
  onUpdated?: () => void
}

export function useHistory(options: HistoryModuleOptions = {}): HistoryModule {
  const max = options.max ?? 64
  const onUpdated = options?.onUpdated ?? (() => {})

  const reducerMap: { [name: ActionName]: Reducer<any, any> } = {}
  let historyStack: SavedAction<any, any>[] = []
  let currentStackIndex = -1

  function setHistoryStack(val: SavedAction<any, any>[]): void {
    historyStack = val
    onUpdated()
  }

  function defineReducer<UndoArgs, RedoArgs>(
    name: ActionName,
    reducer: Reducer<RedoArgs, UndoArgs>
  ) {
    reducerMap[name] = reducer
  }

  function defineReducers<
    RS extends { [name: ActionName]: Reducer<unknown, unknown> }
  >(reducers: RS) {
    for (const name in reducers) {
      reducerMap[name] = reducers[name]
    }

    return {
      dispatch: dispatch as any,
      createAction: <K extends keyof RS>(
        name: K,
        args: Parameters<RS[K]['redo']>[0]
      ) => ({ name, args }),
    }
  }

  function dispatch(
    action: Action<unknown>,
    children?: Action<unknown>[]
  ): void {
    const reducer = getReducer(reducerMap, action.name)

    // check duplication
    if (reducer.ignoreDuplication && currentStackIndex !== -1) {
      const currentAction = historyStack[currentStackIndex]
      if (
        currentAction.name === action.name &&
        (reducer.checkDuplicationFn ?? defaultCheckDuplicationFn)(
          action.args,
          currentAction.redoArgs
        )
      ) {
        // TODO: check children
        return
      }
    }

    pushHistory({
      name: action.name,
      redoArgs: action.args,
      undoArgs: reducer.redo(action.args),
      seriesKey: action.seriesKey,
      children: children?.map((a) => {
        const reducer = getReducer(reducerMap, a.name)
        return {
          name: a.name,
          redoArgs: a.args,
          undoArgs: reducer.redo(a.args),
        }
      }),
    })
  }

  function pushHistory(savedAction: SavedAction<any, any>): void {
    if (currentStackIndex < historyStack.length - 1) {
      historyStack.splice(
        currentStackIndex + 1,
        historyStack.length - currentStackIndex
      )
    }

    if (savedAction.seriesKey) {
      const splitedByKey = splitArray(historyStack, (a) =>
        hasSameSeriesKey(a, savedAction)
      )

      if (splitedByKey.isTrue.length > 0) {
        const before = splitedByKey.isTrue[0]

        if (isSameTypeSavedAction(before, savedAction)) {
          const saved = {
            ...savedAction,
            // last action should inhert undoArgs of the first action having the same seriesKey
            undoArgs: before.undoArgs,
            children: savedAction.children?.map((c, i) => ({
              ...c,
              undoArgs: before.children![i].undoArgs,
            })),
          }

          setHistoryStack(splitedByKey.isFalse.concat(saved))
        } else {
          historyStack.push(savedAction)
        }
      } else {
        historyStack.push(savedAction)
      }
    } else {
      historyStack.push(savedAction)
    }

    if (historyStack.length > max) {
      historyStack.shift()
    }

    currentStackIndex = historyStack.length - 1
    onUpdated()
  }

  function redo() {
    if (currentStackIndex < historyStack.length - 1) {
      _redo()
      onUpdated()
    }
  }

  function _redo() {
    const current = historyStack[currentStackIndex + 1]
    reducerMap[current.name].redo(current.redoArgs)
    current.children?.forEach((c) => reducerMap[c.name].redo(c.redoArgs))
    currentStackIndex = currentStackIndex + 1
  }

  function undo() {
    if (-1 < currentStackIndex) {
      _undo()
      onUpdated()
    }
  }

  function _undo() {
    const current = historyStack[currentStackIndex]
    current.children
      ?.concat()
      .reverse()
      .forEach((c) => reducerMap[c.name].undo(c.undoArgs))
    reducerMap[current.name].undo(current.undoArgs)
    currentStackIndex = currentStackIndex - 1
  }

  function jump(index: number) {
    const target = Math.min(historyStack.length - 1, Math.max(-1, index))

    if (target < currentStackIndex) {
      ;[...Array(currentStackIndex - target)].forEach(() => _undo())
      onUpdated()
    } else if (target > currentStackIndex) {
      ;[...Array(target - currentStackIndex)].forEach(() => _redo())
      onUpdated()
    }
  }

  function getActionSummaries(): ActionSummary[] {
    return historyStack.map((a, i) => {
      const reducer = getReducer(reducerMap, a.name)
      return {
        name: a.name,
        label: reducer.getLabel?.({ name: a.name, args: a.redoArgs }) ?? a.name,
        done: i <= currentStackIndex,
      }
    })
  }

  function serialize(): SerializedState {
    return { version: '0', stack: historyStack, currentStackIndex }
  }

  /**
   * just deserializes and does not call redo operations
   */
  function deserialize(state: SerializedState): void {
    setHistoryStack(state.stack.concat())
    currentStackIndex = state.currentStackIndex
  }

  function clear(): void {
    setHistoryStack([])
    currentStackIndex = -1
  }

  return {
    defineReducer,
    defineReducers,
    dispatch,
    redo,
    undo,
    jump,
    getCurrentIndex: () => currentStackIndex,
    getActionSummaries,
    serialize,
    deserialize,
    clear,
  }
}

function getReducer(
  reducerMap: { [name: ActionName]: Reducer<any, any> },
  name: ActionName
): Reducer<any, any> {
  const reducer = reducerMap[name]
  if (!reducer) throw new Error(`not found a reducer for the action: ${name}`)
  return reducer
}

function hasSameSeriesKey(
  a: { seriesKey?: string },
  b: { seriesKey?: string }
): boolean {
  return !!a.seriesKey && !!b.seriesKey && a.seriesKey === b.seriesKey
}

function splitArray<T>(
  arr: T[],
  checkFn: (item: T) => boolean
): { isTrue: T[]; isFalse: T[] } {
  const ret: { isTrue: T[]; isFalse: T[] } = { isTrue: [], isFalse: [] }

  arr.forEach((item) =>
    checkFn(item) ? ret.isTrue.push(item) : ret.isFalse.push(item)
  )

  return ret
}

function defaultCheckDuplicationFn(a: unknown, b: unknown): boolean {
  return a === b
}

function isSameTypeSavedAction(
  a: SavedAction<unknown, unknown>,
  b: SavedAction<unknown, unknown>
): boolean {
  return (
    a.name === b.name &&
    (a.children === b.children ||
      (!!a.children &&
        !!b.children &&
        a.children.length === b.children.length &&
        a.children.every((ac, i) => ac.name === b.children![i].name)))
  )
}
