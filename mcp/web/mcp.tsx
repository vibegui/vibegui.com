import {
  type App,
  type McpUiHostContext,
  useApp,
  useHostStyles,
} from "@modelcontextprotocol/ext-apps/react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

interface McpViewState {
  connected: boolean;
  loading: boolean;
  toolName?: string;
  toolResult?: unknown;
  error?: string;
}

interface McpContextValue extends McpViewState {
  callTool: <T>(name: string, args?: Record<string, unknown>) => Promise<T>;
  hostContext?: McpUiHostContext;
}

const McpContext = createContext<McpContextValue | null>(null);

export function McpProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<McpViewState>({
    connected: false,
    loading: false,
  });
  const [hostContext, setHostContext] = useState<
    McpUiHostContext | undefined
  >();

  const onAppCreated = useCallback((created: App) => {
    created.ontoolinput = (params) => {
      setView((current) => ({
        ...current,
        loading: true,
        toolName: current.toolName,
        error: undefined,
        toolResult: undefined,
      }));
      if (created.getHostContext()?.toolInfo?.tool.name) {
        setView((current) => ({
          ...current,
          toolName: created.getHostContext()?.toolInfo?.tool.name,
        }));
      }
      void params;
    };

    created.ontoolresult = (result) => {
      const text = result.content?.find((item) => item.type === "text");
      setView((current) => ({
        ...current,
        loading: false,
        toolResult: result.structuredContent,
        error: result.isError && text?.type === "text" ? text.text : undefined,
      }));
    };

    created.ontoolcancelled = () => {
      setView((current) => ({
        ...current,
        loading: false,
        error: "Tool call cancelled",
      }));
    };

    created.onerror = (error) => {
      setView((current) => ({
        ...current,
        loading: false,
        error: String(error),
      }));
    };

    created.onhostcontextchanged = (context) => {
      setHostContext((current) => ({ ...current, ...context }));
    };
  }, []);

  const { app, isConnected } = useApp({
    appInfo: {
      name: "VibeGui Personal AI OS",
      version: "0.1.0",
    },
    capabilities: {},
    onAppCreated,
  });

  useHostStyles(app, app?.getHostContext());

  useEffect(() => {
    if (!isConnected) return;
    const context = app?.getHostContext();
    setHostContext(context);
    setView((current) => ({
      ...current,
      connected: true,
      toolName: current.toolName ?? context?.toolInfo?.tool.name,
    }));
  }, [app, isConnected]);

  const callTool = useCallback(
    async <T,>(
      name: string,
      args: Record<string, unknown> = {},
    ): Promise<T> => {
      if (!app) throw new Error("MCP App is not connected");
      setView((current) => ({
        ...current,
        loading: true,
        toolName: name,
        toolResult: undefined,
        error: undefined,
      }));

      try {
        const result = await app.callServerTool({
          name,
          arguments: args,
        });
        if (result.isError) {
          const text = result.content?.find((item) => item.type === "text");
          throw new Error(
            text?.type === "text" ? text.text : `${name} returned an error`,
          );
        }
        setView((current) => ({
          ...current,
          loading: false,
          toolResult: result.structuredContent,
        }));
        return result.structuredContent as T;
      } catch (error) {
        setView((current) => ({
          ...current,
          loading: false,
          error: String(error),
        }));
        throw error;
      }
    },
    [app],
  );

  const value = useMemo(
    () => ({ ...view, callTool, hostContext }),
    [callTool, hostContext, view],
  );

  return <McpContext.Provider value={value}>{children}</McpContext.Provider>;
}

export function useMcp(): McpContextValue {
  const context = useContext(McpContext);
  if (!context) {
    throw new Error("useMcp must be used inside McpProvider");
  }
  return context;
}
