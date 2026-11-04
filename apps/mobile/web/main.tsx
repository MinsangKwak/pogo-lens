import React from 'react';
import {createRoot} from 'react-dom/client';
import App from '../App';
import './style.css';

class PreviewBoundary extends React.Component<React.PropsWithChildren, {failed: boolean}> {
  state = {failed: false};

  static getDerivedStateFromError() { return {failed: true}; }

  render() {
    if (this.state.failed) return <main className="preview-error" role="alert">
      <h1>웹 화면을 불러오지 못했어요.</h1>
      <p>페이지를 새로고침한 뒤 다시 시도해 주세요. 이 탭의 체험 기록은 초기화됩니다.</p>
      <button type="button" onClick={() => window.location.reload()}>새로고침하기</button>
    </main>;
    return this.props.children;
  }
}

const root = document.getElementById('root');
if (!root) throw new Error('웹 화면의 시작 영역을 찾지 못했어요.');
createRoot(root).render(<React.StrictMode><PreviewBoundary><App /></PreviewBoundary></React.StrictMode>);
