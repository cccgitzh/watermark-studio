import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * 渲染期兜底：任何一个组件抛错都不应该留下白屏。
 * 界面退化成一张「纸」，给出两条恢复路径 —— 重载，或清掉本地方案后重载。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[watermark] render crashed', error, info.componentStack);
  }

  private resetData = (): void => {
    try {
      localStorage.removeItem('wms.presets.v2');
      localStorage.removeItem('wms.theme.v2');
    } catch {
      // 存储不可用时仍然重载
    }
    window.location.reload();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="crash">
        <div className="crash-sheet">
          <h1 className="crash-title">这一步没能画出来</h1>
          <p className="crash-meta">渲染中断 · 图片没有被上传，也没有写入任何文件</p>
          <p className="crash-body">
            图片只在本机内存中处理，重载后需要重新导入。如果是自定义方案导致的，可以先清掉本地方案。
          </p>
          <pre className="crash-detail">{error.message}</pre>
          <div className="crash-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={() => window.location.reload()}
            >
              重新加载
            </button>
            <button type="button" className="button" onClick={this.resetData}>
              清除本地方案并重载
            </button>
          </div>
        </div>
      </div>
    );
  }
}
