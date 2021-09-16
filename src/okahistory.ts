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
}

export interface SavedAction<RedoArgs, UndoArgs> {
  name: ActionName
  redoArgs: RedoArgs
  undoArgs: UndoArgs
  seriesKey?: string
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
  execAction<RedoArgs>(action: Action<RedoArgs>): void
  redo(): void
  undo(): void
  getCurrentIndex(): number
  getActionSummaries(): ActionSummary[]
  serialize(): SerializedState
  deserialize(state: SerializedState): void
}

export function useHistory(): HistoryModule {
  const reducerMap: { [name: ActionName]: Reducer<any, any> } = {}
  let historyStack: SavedAction<any, any>[] = []
  let currentStackIndex = -1

  function setHistoryStack(val: SavedAction<any, any>[]): void {
    historyStack = val
  }

  function defineReducer<UndoArgs, RedoArgs>(
    name: ActionName,
    reducer: Reducer<RedoArgs, UndoArgs>
  ) {
    reducerMap[name] = reducer
  }

  function execAction<RedoArgs>(action: Action<RedoArgs>): void {
    const reducer = getReducer(reducerMap, action.name)
    const undoArgs = reducer.redo(action.args)

    pushHistory({
      name: action.name,
      redoArgs: action.args,
      undoArgs,
      seriesKey: action.seriesKey,
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
      setHistoryStack(splitedByKey.isFalse)

      historyStack.push({
        ...savedAction,
        // last action should inhert undoArgs of the first action having the same seriesKey
        undoArgs:
          splitedByKey.isTrue.length > 0
            ? splitedByKey.isTrue[0].undoArgs
            : savedAction.undoArgs,
      })
    } else {
      historyStack.push(savedAction)
    }

    currentStackIndex = historyStack.length - 1
  }

  function redo() {
    if (currentStackIndex < historyStack.length - 1) {
      const current = historyStack[currentStackIndex + 1]
      reducerMap[current.name].redo(current.redoArgs)
      currentStackIndex = currentStackIndex + 1
    }
  }

  function undo() {
    if (-1 < currentStackIndex) {
      const current = historyStack[currentStackIndex]
      reducerMap[current.name].undo(current.undoArgs)
      currentStackIndex = currentStackIndex - 1
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

  return {
    defineReducer,
    execAction,
    redo,
    undo,
    getCurrentIndex: () => currentStackIndex,
    getActionSummaries,
    serialize,
    deserialize,
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
