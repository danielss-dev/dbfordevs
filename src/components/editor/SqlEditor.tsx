import { useEffect, useRef, useMemo } from "react";
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import type * as MonacoEditor from "monaco-editor";
import { createSqlCompletionProvider } from "./sql-completion-provider";
import { registerCustomThemes, getMonacoTheme } from "./monaco-themes";
import type { TableInfo, TableSchema } from "@/types";

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute?: (sql: string) => void;
  onExplainWithAI?: (sql: string) => void;
  onOptimizeWithAI?: (sql: string) => void;
  tables?: TableInfo[];
  schemas?: Record<string, TableSchema>;
  theme?: "light" | "dark" | "system" | string;
  themeVariant?: "light" | "dark";
  readOnly?: boolean;
  height?: string | number;
}

export function SqlEditor({
  value,
  onChange,
  onExecute,
  onExplainWithAI,
  onOptimizeWithAI,
  tables = [],
  schemas = {},
  theme = "dark",
  themeVariant,
  readOnly = false,
  height = "100%",
}: SqlEditorProps) {
  const editorRef = useRef<MonacoEditor.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const completionDisposableRef = useRef<MonacoEditor.IDisposable | null>(null);
  const actionDisposablesRef = useRef<MonacoEditor.IDisposable[]>([]);
  const tablesRef = useRef<TableInfo[]>(tables);
  const schemasRef = useRef<Record<string, TableSchema>>(schemas);
  const onExecuteRef = useRef(onExecute);
  const onExplainWithAIRef = useRef(onExplainWithAI);
  const onOptimizeWithAIRef = useRef(onOptimizeWithAI);

  // Keep refs in sync
  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);

  useEffect(() => {
    schemasRef.current = schemas;
  }, [schemas]);

  useEffect(() => {
    onExecuteRef.current = onExecute;
  }, [onExecute]);

  useEffect(() => {
    onExplainWithAIRef.current = onExplainWithAI;
  }, [onExplainWithAI]);

  useEffect(() => {
    onOptimizeWithAIRef.current = onOptimizeWithAI;
  }, [onOptimizeWithAI]);

  // Determine Monaco theme based on app theme
  const monacoTheme = useMemo(() => {
    // For extension themes, use the explicit themeVariant prop
    if (theme.startsWith("ext:") && themeVariant) {
      return themeVariant === "light" ? "dbfordevs-light" : "dbfordevs-dark";
    }
    return getMonacoTheme(theme);
  }, [theme, themeVariant]);

  // Handle editor mount
  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Register custom themes
    registerCustomThemes(monaco);

    // Set initial theme
    monaco.editor.setTheme(monacoTheme);

    // Register completion provider for SQL
    completionDisposableRef.current = monaco.languages.registerCompletionItemProvider(
      "sql",
      createSqlCompletionProvider({
        getTables: () => tablesRef.current,
        getTableSchema: (tableName) => schemasRef.current[tableName] || null,
      })
    );

    // Register Ctrl/Cmd+Enter shortcut for query execution
    const executeAction = editor.addAction({
      id: "execute-query",
      label: "Execute Query",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: (ed) => {
        const sql = ed.getValue();
        if (sql.trim() && onExecuteRef.current) {
          onExecuteRef.current(sql);
        }
      },
    });
    actionDisposablesRef.current.push(executeAction);

    // Register "Explain with AI" context menu action
    const explainAction = editor.addAction({
      id: "explain-with-ai",
      label: "Explain with AI",
      contextMenuGroupId: "ai",
      contextMenuOrder: 1,
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyE],
      run: (ed) => {
        const selection = ed.getSelection();
        let sql = "";
        if (selection && !selection.isEmpty()) {
          sql = ed.getModel()?.getValueInRange(selection) || "";
        } else {
          sql = ed.getValue();
        }
        if (sql.trim() && onExplainWithAIRef.current) {
          onExplainWithAIRef.current(sql);
        }
      },
    });
    actionDisposablesRef.current.push(explainAction);

    // Register "Optimize with AI" context menu action
    const optimizeAction = editor.addAction({
      id: "optimize-with-ai",
      label: "Optimize with AI",
      contextMenuGroupId: "ai",
      contextMenuOrder: 2,
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyO],
      run: (ed) => {
        const selection = ed.getSelection();
        let sql = "";
        if (selection && !selection.isEmpty()) {
          sql = ed.getModel()?.getValueInRange(selection) || "";
        } else {
          sql = ed.getValue();
        }
        if (sql.trim() && onOptimizeWithAIRef.current) {
          onOptimizeWithAIRef.current(sql);
        }
      },
    });
    actionDisposablesRef.current.push(optimizeAction);

    // Focus the editor
    editor.focus();
  };

  // Cleanup completion provider and actions on unmount
  useEffect(() => {
    return () => {
      completionDisposableRef.current?.dispose();
      actionDisposablesRef.current.forEach(d => d.dispose());
      actionDisposablesRef.current = [];
    };
  }, []);

  // Update theme when app theme changes
  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(monacoTheme);
    }
  }, [monacoTheme]);

  return (
    <Editor
      height={height}
      defaultLanguage="sql"
      value={value}
      onChange={(val) => onChange(val ?? "")}
      onMount={handleEditorMount}
      theme={monacoTheme}
      loading={
        <div className="flex h-full items-center justify-center text-muted-foreground">
          Loading editor...
        </div>
      }
      options={{
        // Appearance
        minimap: { enabled: false },
        lineNumbers: "on",
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
        fontLigatures: true,
        renderLineHighlight: "line",
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        smoothScrolling: true,
        padding: { top: 12, bottom: 12 },

        // Behavior
        wordWrap: "on",
        automaticLayout: true,
        tabSize: 2,
        insertSpaces: true,
        readOnly,
        scrollBeyondLastLine: false,

        // Auto-complete settings
        suggestOnTriggerCharacters: true,
        quickSuggestions: {
          other: true,
          comments: false,
          strings: false,
        },
        acceptSuggestionOnEnter: "on",
        tabCompletion: "on",
        wordBasedSuggestions: "off",

        // Accessibility
        accessibilitySupport: "auto",
        folding: true,
        showFoldingControls: "always",
        foldingHighlight: true,
        foldingStrategy: "indentation",

        // Find widget settings
        find: {
          addExtraSpaceOnTop: false,
          autoFindInSelection: "multiline",
        },
      }}
    />
  );
}
