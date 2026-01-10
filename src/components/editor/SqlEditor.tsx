import { useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from "react";
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import type * as MonacoEditor from "monaco-editor";
import { createSqlCompletionProvider } from "./sql-completion-provider";
import { registerCustomThemes, getMonacoTheme } from "./monaco-themes";
import { formatSql, mapDatabaseTypeToDialect, type SqlFormatterOptions } from "@/lib/sql-formatter";
import type { TableInfo, TableSchema } from "@/types";

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute?: (sql: string) => void;
  onExplainWithAI?: (sql: string) => void;
  onOptimizeWithAI?: (sql: string) => void;
  onFormat?: () => void;
  tables?: TableInfo[];
  schemas?: Record<string, TableSchema>;
  theme?: "light" | "dark" | "system" | "nordic-dark" | "nordic-light";
  databaseType?: string;
  formatterOptions?: SqlFormatterOptions;
  readOnly?: boolean;
  height?: string | number;
}

export interface SqlEditorHandle {
  format: () => void;
  focus: () => void;
}

export const SqlEditor = forwardRef<SqlEditorHandle, SqlEditorProps>(function SqlEditor({
  value,
  onChange,
  onExecute,
  onExplainWithAI,
  onOptimizeWithAI,
  onFormat,
  tables = [],
  schemas = {},
  theme = "dark",
  databaseType,
  formatterOptions,
  readOnly = false,
  height = "100%",
}, ref) {
  const editorRef = useRef<MonacoEditor.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const completionDisposableRef = useRef<MonacoEditor.IDisposable | null>(null);
  const actionDisposablesRef = useRef<MonacoEditor.IDisposable[]>([]);
  const tablesRef = useRef<TableInfo[]>(tables);
  const schemasRef = useRef<Record<string, TableSchema>>(schemas);
  const onExecuteRef = useRef(onExecute);
  const onExplainWithAIRef = useRef(onExplainWithAI);
  const onOptimizeWithAIRef = useRef(onOptimizeWithAI);
  const onFormatRef = useRef(onFormat);
  const databaseTypeRef = useRef(databaseType);
  const formatterOptionsRef = useRef(formatterOptions);

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

  useEffect(() => {
    onFormatRef.current = onFormat;
  }, [onFormat]);

  useEffect(() => {
    databaseTypeRef.current = databaseType;
  }, [databaseType]);

  useEffect(() => {
    formatterOptionsRef.current = formatterOptions;
  }, [formatterOptions]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    format: () => {
      if (editorRef.current) {
        editorRef.current.trigger("button", "format-sql", null);
      }
    },
    focus: () => {
      editorRef.current?.focus();
    },
  }), []);

  // Determine Monaco theme based on app theme
  const monacoTheme = useMemo(() => {
    return getMonacoTheme(theme);
  }, [theme]);

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

    // Register "Format SQL" action with Shift+Alt+F shortcut
    const formatAction = editor.addAction({
      id: "format-sql",
      label: "Format SQL",
      contextMenuGroupId: "1_modification",
      contextMenuOrder: 1.5,
      keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
      run: (ed) => {
        const selection = ed.getSelection();
        const model = ed.getModel();
        if (!model) return;

        const dialect = mapDatabaseTypeToDialect(databaseTypeRef.current);
        const options = {
          dialect,
          ...formatterOptionsRef.current,
        };

        // Check if there's a selection
        if (selection && !selection.isEmpty()) {
          // Format only the selection
          const selectedText = model.getValueInRange(selection);
          if (selectedText.trim()) {
            const formatted = formatSql(selectedText, options);
            ed.executeEdits("format-sql", [
              {
                range: selection,
                text: formatted,
                forceMoveMarkers: true,
              },
            ]);
          }
        } else {
          // Format the entire document
          const fullText = ed.getValue();
          if (fullText.trim()) {
            const formatted = formatSql(fullText, options);
            // Replace entire content while preserving cursor position as best as possible
            const fullRange = model.getFullModelRange();
            ed.executeEdits("format-sql", [
              {
                range: fullRange,
                text: formatted,
                forceMoveMarkers: true,
              },
            ]);
          }
        }

        // Call the optional callback
        if (onFormatRef.current) {
          onFormatRef.current();
        }
      },
    });
    actionDisposablesRef.current.push(formatAction);

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
});
