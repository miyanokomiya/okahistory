export type ActionName = string

export interface Action<RedoArgs> {
  name: ActionName
  args: RedoArgs
}

export interface Reducer<RedoArgs, UndoArgs> {
  redo(redoState: RedoArgs): UndoArgs
  undo(undoState: UndoArgs): void
}

export interface SavedAction<RedoArgs, UndoArgs> {
  name: ActionName
  redoArgs: RedoArgs
  undoArgs: UndoArgs
}

interface HistoryModule {
  registReducer<UndoArgs, RedoArgs>(
    name: ActionName,
    reducer: Reducer<RedoArgs, UndoArgs>
  ): void
  execAction<RedoArgs>(action: Action<RedoArgs>): void
  redo(): void
  undo(): void
  getCurrentIndex(): number
}

export function useHistory(): HistoryModule {
  const reducerMap: { [name: ActionName]: Reducer<unknown, unknown> } = {}
  const historyStack: SavedAction<unknown, unknown>[] = []
  let currentStackIndex = -1

  function registReducer<UndoArgs, RedoArgs>(
    name: ActionName,
    reducer: Reducer<RedoArgs, UndoArgs>
  ) {
    reducerMap[name] = reducer
  }

  function execAction<RedoArgs>(action: Action<RedoArgs>): void {
    const reducer = reducerMap[action.name]
    if (!reducer) throw new Error(`not found the action: ${action.name}`)

    const undoArgs = reducer.redo(action.args)

    pushHistory({
      name: action.name,
      redoArgs: action.args,
      undoArgs,
    })
  }

  function pushHistory(savedAction: SavedAction<unknown, unknown>): void {
    if (currentStackIndex < historyStack.length - 1) {
      historyStack.splice(
        currentStackIndex + 1,
        historyStack.length - currentStackIndex
      )
    }
    historyStack.push(savedAction)
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

  return {
    registReducer,
    execAction,
    redo,
    undo,
    getCurrentIndex: () => currentStackIndex,
  }
}
