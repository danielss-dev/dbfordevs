import { useEffect, useRef, useMemo } from "react";
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import type * as MonacoEditor from "monaco-editor";
import { createSqlCompletionProvider } from "./sql-completion-provider";
import { registerCustomThemes, getMonacoTheme } from "./monaco-themes";
import type { TableInfo, TableSchema } from "@/types";

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute?: () => void;
  tables?: TableInfo[];
  getTableSchema?: (tableName: string) => Promise<TableSchema | null>;
  theme?: "light" | "dark" | "system";
  readOnly?: boolean;
  height?: string | number;
}

export function SqlEditor({
  value,
  onChange,
  onExecute,
  tables = [],
  getTableSchema,
  theme = "dark",
  readOnly = false,
  height = "100%",
}: SqlEditorProps) {
  const editorRef = useRef<MonacoEditor.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const completionDisposableRef = useRef<MonacoEditor.IDisposable | null>(null);
  const tablesRef = useRef<TableInfo[]>(tables);
  const getTableSchemaRef = useRef(getTableSchema);

  // Keep refs in sync
  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);

  useEffect(() => {
    getTableSchemaRef.current = getTableSchema;
  }, [getTableSchema]);

  // Schema cache
  const schemaCache = useMemo(() => new Map<string, TableSchema>(), []);

  // Determine Monaco theme based on app theme
  const monacoTheme = useMemo(() => getMonacoTheme(theme), [theme]);

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
        getTableSchema: async (tableName) => {
          if (getTableSchemaRef.current) {
            return getTableSchemaRef.current(tableName);
          }
          return null;
        },
        schemaCache,
      })
    );

    // Register Ctrl/Cmd+Enter shortcut for query execution
    editor.addAction({
      id: "execute-query",
      label: "Execute Query",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => {
        onExecute?.();
      },
    });

    // Focus the editor
    editor.focus();
  };

  // Cleanup completion provider on unmount
  useEffect(() => {
    return () => {
      completionDisposableRef.current?.dispose();
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
      }}
    />
  );
}
