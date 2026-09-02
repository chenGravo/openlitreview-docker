'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

const DEFAULT_YEAR_TO = 2026;
const MAX_YEAR = 2100;
const ACTIVE_RUN_KEY = 'openlitreview-active-run';

type Artifact = {
  id: number;
  name: string;
  kind: 'manuscript' | 'audit';
  downloadUrl: string;
};

type Run = {
  id: number;
  title: string;
  status: string;
  conclusion: string | null;
  createdAt: string;
  updatedAt?: string;
  failedStep?: string | null;
  artifacts?: Artifact[];
};

export default function ReviewPortal() {
  const [activeRun, setActiveRun] = useState<Run | null>(null);
  const [recentRuns, setRecentRuns] = useState<Run[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadRun = useCallback(async (runId: number) => {
    const response = await fetch(`/api/reviews?runId=${runId}`, { cache: 'no-store' });
    const payload = await response.json() as { ok: boolean; run?: Run; error?: string };
    if (!response.ok || !payload.run) throw new Error(payload.error || '暂时无法查询任务。');
    setActiveRun(payload.run);
    if (payload.run.status === 'completed') localStorage.removeItem(ACTIVE_RUN_KEY);
    return payload.run;
  }, []);

  const loadRecent = useCallback(async () => {
    try {
      const response = await fetch('/api/reviews', { cache: 'no-store' });
      const payload = await response.json() as { runs?: Run[] };
      const runs = response.ok ? payload.runs || [] : [];
      if (response.ok) setRecentRuns(runs);
      return runs;
    } catch {
      // The current task remains usable even when history is temporarily unavailable.
      return [];
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRecent();
      const stored = Number(localStorage.getItem(ACTIVE_RUN_KEY));
      if (Number.isSafeInteger(stored) && stored > 0) {
        void loadRun(stored).catch(() => localStorage.removeItem(ACTIVE_RUN_KEY));
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRecent, loadRun]);

  useEffect(() => {
    if (!activeRun || activeRun.status === 'completed') return;
    const timer = window.setInterval(() => {
      void loadRun(activeRun.id).catch((reason: Error) => setError(reason.message));
    }, 15000);
    return () => window.clearInterval(timer);
  }, [activeRun, loadRun]);

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setNotice('');
    const data = new FormData(event.currentTarget);
    const request = {
      title: String(data.get('title') || ''),
      researchQuestion: String(data.get('researchQuestion') || ''),
      keywords: String(data.get('keywords') || ''),
      yearFrom: Number(data.get('yearFrom')),
      yearTo: Number(data.get('yearTo')),
      targetCharacters: Number(data.get('targetCharacters')),
      requirements: String(data.get('requirements') || ''),
    };
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      const payload = await response.json() as {
        ok: boolean;
        accepted?: boolean;
        runId?: number | null;
        error?: string;
      };
      if (!response.ok || !payload.ok) throw new Error(payload.error || '任务启动失败。');
      if (!payload.runId && payload.accepted) {
        setNotice('任务已经提交，正在同步编号。请勿再次点击，页面会自动显示任务状态。');
        window.setTimeout(async () => {
          const runs = await loadRecent();
          const latest = runs.find((run) => run.title === request.title);
          if (latest) {
            setActiveRun(latest);
            localStorage.setItem(ACTIVE_RUN_KEY, String(latest.id));
            setNotice('');
          }
        }, 5000);
        return;
      }
      if (!payload.runId) throw new Error('任务状态同步失败，请勿重复提交。');
      const queued: Run = {
        id: payload.runId,
        title: request.title,
        status: 'queued',
        conclusion: null,
        createdAt: new Date().toISOString(),
      };
      setActiveRun(queued);
      localStorage.setItem(ACTIVE_RUN_KEY, String(payload.runId));
      window.setTimeout(() => {
        void loadRun(payload.runId as number).catch((reason: Error) => setError(reason.message));
      }, 3500);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '任务启动失败。');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="文澜综述首页">
          <span className="brand-mark" aria-hidden="true">文</span>
          <span><strong>文澜综述</strong><small>OpenLitReview</small></span>
        </a>
        <div className="topbar-actions">
          <InstallPortal />
          <span className="private-badge"><span aria-hidden="true" /> 私人云端入口</span>
        </div>
      </header>

      <section id="top" className="hero">
        <div className="hero-copy">
          <p className="eyebrow">循证 · 可核查 · 按需运行</p>
          <h1>从一个研究问题，<br />到一篇标准中文文献综述</h1>
          <p className="lede">
            填写研究主题即可。系统会检索高关联度外文文献，核验开放全文，
            由 DeepSeek 与 Kimi 分工综合，并按国家标准整理参考文献。
          </p>
        </div>

        <div className="route-card" aria-label="两模型协作路线">
          <p className="route-label">高效双模型路线</p>
          <ol>
            <li><span>01</span><div><strong>DeepSeek V4 Flash</strong><small>检索扩展与逐篇证据提取</small></div></li>
            <li><span>02</span><div><strong>Kimi K2.6</strong><small>跨文献综合、提纲、正文与成稿复核</small></div></li>
          </ol>
        </div>
      </section>

      <section className="workspace" aria-labelledby="form-title">
        <div className="form-heading">
          <div>
            <p className="step-label">新建综述任务</p>
            <h2 id="form-title">告诉我你想研究什么</h2>
          </div>
          <p>预计运行 30–120 分钟，完成后可下载 DOCX、PDF 和证据审计包。</p>
        </div>

        {activeRun && <RunStatus run={activeRun} onRefresh={() => void loadRun(activeRun.id)} />}
        {notice && <p className="notice-banner" role="status">{notice}</p>}
        {error && <p className="error-banner" role="alert">{error}</p>}

        <form onSubmit={submitReview} className="review-form">
          <label className="field field-wide">
            <span>综述题目 <b>*</b></span>
            <input name="title" required minLength={3} maxLength={300} placeholder="例如：学校体育与青少年心理健康研究综述" />
          </label>

          <label className="field field-wide">
            <span>希望重点回答的问题 <b>*</b></span>
            <textarea name="researchQuestion" required minLength={5} maxLength={2000} rows={3} placeholder="例如：不同类型的学校体育活动如何影响青少年的焦虑、抑郁和主观幸福感？" />
          </label>

          <label className="field">
            <span>文献起始年份</span>
            <input name="yearFrom" type="number" min="1950" max={MAX_YEAR} defaultValue="2000" />
          </label>

          <label className="field">
            <span>文献截止年份</span>
            <input name="yearTo" type="number" min="1950" max={MAX_YEAR} defaultValue={DEFAULT_YEAR_TO} />
          </label>

          <label className="field">
            <span>目标字数</span>
            <select name="targetCharacters" defaultValue="8000">
              <option value="4000">约 4,000 字</option>
              <option value="6000">约 6,000 字</option>
              <option value="8000">约 8,000 字</option>
              <option value="10000">约 10,000 字</option>
              <option value="12000">约 12,000 字</option>
            </select>
          </label>

          <label className="field">
            <span>关键词 <em>可选</em></span>
            <input name="keywords" maxLength={500} placeholder="不填写时由系统自动生成" />
          </label>

          <label className="field field-wide">
            <span>补充要求 <em>可选</em></span>
            <textarea name="requirements" maxLength={5000} rows={3} placeholder="例如：重点比较不同年龄群体，并单独讨论安全性证据。" />
          </label>

          <div className="confirmations field-wide">
            <label><input type="checkbox" required /><span>我确认未填写患者信息、联系方式、保密资料或其他敏感个人信息。</span></label>
            <label><input type="checkbox" required /><span>我确认有权处理相关材料，并同意本次任务最高预留 35 元模型额度（DeepSeek 最多 15 元，Kimi 最多 20 元）。</span></label>
          </div>

          <div className="submit-row field-wide">
            <div><strong>按需启动</strong><span>提交后才会运行，完成后自动停止，不占用本地资源。</span></div>
            <button type="submit" disabled={submitting}>
              {submitting ? '正在安全启动…' : '开始生成综述'} <span aria-hidden="true">→</span>
            </button>
          </div>
        </form>
      </section>

      {recentRuns.length > 0 && (
        <section className="recent" aria-labelledby="recent-title">
          <div><p className="step-label">最近任务</p><h2 id="recent-title">继续查看以前的运行</h2></div>
          <div className="recent-list">
            {recentRuns.map((run) => (
              <button key={run.id} type="button" onClick={() => void loadRun(run.id)}>
                <span><strong>{run.title}</strong><small>{formatDate(run.createdAt)}</small></span>
                <em className={`run-dot ${statusTone(run)}`}>{statusLabel(run)}</em>
              </button>
            ))}
          </div>
        </section>
      )}

      <footer>
        <span>文献网站只会收到学术检索词和必要的文献标识，不会收到你的姓名、邮箱或账号信息。</span>
        <span>GB/T 7714—2025 · 外文文献优先 · 全程预算保护</span>
      </footer>
    </main>
  );
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function InstallPortal() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [hint, setHint] = useState('');

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
    const receivePrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', receivePrompt);
    return () => window.removeEventListener('beforeinstallprompt', receivePrompt);
  }, []);

  async function install() {
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      setHint(choice.outcome === 'accepted' ? '已添加到设备' : '可随时再次添加');
      setPromptEvent(null);
      return;
    }
    setHint('请用浏览器菜单选择“添加到主屏幕”或“安装应用”');
  }

  return (
    <div className="install-control">
      <button type="button" onClick={() => void install()}>安装快捷入口</button>
      {hint && <span role="status">{hint}</span>}
    </div>
  );
}

function RunStatus({ run, onRefresh }: { run: Run; onRefresh: () => void }) {
  const complete = run.status === 'completed';
  const success = complete && run.conclusion === 'success';
  return (
    <section className={`run-status ${statusTone(run)}`} aria-live="polite">
      <div className="run-status-head">
        <span className="status-symbol" aria-hidden="true" />
        <div><small>当前任务</small><strong>{run.title}</strong></div>
        <span className="status-chip">{statusLabel(run)}</span>
      </div>
      {!complete && (
        <div className="progress-track"><span /></div>
      )}
      {success && (run.artifacts?.length || 0) > 0 && (
        <div className="artifact-row">
          {run.artifacts?.map((artifact) => (
            <a key={artifact.id} href={artifact.downloadUrl}>
              {artifact.kind === 'manuscript' ? '下载正式稿件' : '下载证据审计包'}
            </a>
          ))}
        </div>
      )}
      {complete && !success && (
        <p className="run-message">
          任务在“{run.failedStep || '云端处理'}”阶段未完成。费用保护仍然有效，请检查模型余额后重试。
        </p>
      )}
      <button className="refresh-button" type="button" onClick={onRefresh}>刷新状态</button>
    </section>
  );
}

function statusLabel(run: Run) {
  if (run.status !== 'completed') return run.status === 'queued' ? '等待开始' : '正在处理';
  if (run.conclusion === 'success') return '已经完成';
  if (run.conclusion === 'cancelled') return '已经取消';
  return '未完成';
}

function statusTone(run: Run) {
  if (run.status !== 'completed') return 'running';
  return run.conclusion === 'success' ? 'success' : 'failure';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}
