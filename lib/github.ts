const API_VERSION = '2026-03-10';
const ACCEPT = 'application/vnd.github+json';

export type ReviewRequest = {
  title: string;
  researchQuestion: string;
  keywords: string;
  yearFrom: number;
  yearTo: number;
  targetCharacters: number;
  requirements: string;
};

export class PortalError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function requirePortalUser(request: Request) {
  const url = new URL(request.url);
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (isLocal || request.headers.get('oai-authenticated-user-id')) return;

  const expectedUser = process.env.PORTAL_BASIC_AUTH_USER?.trim();
  const expectedPassword = process.env.PORTAL_BASIC_AUTH_PASSWORD;
  if (expectedUser && expectedPassword && hasValidBasicAuth(request, expectedUser, expectedPassword)) return;

  throw new PortalError('请先登录私人网页。', 401);
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    throw new PortalError('请求来源无效。', 403);
  }
}

export function validateReviewRequest(value: unknown): ReviewRequest {
  if (!value || typeof value !== 'object') {
    throw new PortalError('请填写综述任务。');
  }
  const input = value as Record<string, unknown>;
  const title = cleanText(input.title, 3, 300, '综述题目');
  const researchQuestion = cleanText(
    input.researchQuestion,
    5,
    2000,
    '核心问题',
  );
  const keywords = optionalText(input.keywords, 500, '关键词');
  const requirements = optionalText(input.requirements, 5000, '补充要求');
  const yearFrom = boundedInteger(input.yearFrom, 1950, 2100, '起始年份');
  const yearTo = boundedInteger(input.yearTo, 1950, 2100, '截止年份');
  if (yearFrom > yearTo) {
    throw new PortalError('起始年份不能晚于截止年份。');
  }
  const targetCharacters = boundedInteger(
    input.targetCharacters,
    4000,
    12000,
    '目标字数',
  );
  if (![4000, 6000, 8000, 10000, 12000].includes(targetCharacters)) {
    throw new PortalError('请选择页面提供的目标字数。');
  }
  rejectPersonalIdentifiers([title, researchQuestion, keywords, requirements]);
  return {
    title,
    researchQuestion,
    keywords,
    yearFrom,
    yearTo,
    targetCharacters,
    requirements,
  };
}

export async function githubRequest(path: string, init: RequestInit = {}) {
  const token = process.env.GITHUB_WORKFLOW_TOKEN?.trim();
  if (!token) {
    throw new PortalError('网页尚未完成云端授权，请稍后再试。', 503);
  }
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: ACCEPT,
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': API_VERSION,
      'User-Agent': 'OpenLitReview-Private-Portal/1.0',
      ...init.headers,
    },
    cache: 'no-store',
  });
  return response;
}

export function repositoryConfig() {
  return {
    owner: process.env.GITHUB_WORKFLOW_OWNER?.trim() || 'chenGravo',
    repository:
      process.env.GITHUB_WORKFLOW_REPOSITORY?.trim() ||
      'openlitreview-workspace',
    workflow: process.env.GITHUB_WORKFLOW_FILE?.trim() || 'run-review.yml',
    ref: process.env.GITHUB_WORKFLOW_REF?.trim() || 'main',
  };
}

export function githubError(status: number) {
  if (status === 401 || status === 403) {
    return new PortalError('云端授权无效或权限不足。', 502);
  }
  if (status === 404) {
    return new PortalError('没有找到对应的云端任务。', 404);
  }
  if (status === 429) {
    return new PortalError('云端请求过于频繁，请稍后再试。', 429);
  }
  return new PortalError(`云端服务暂时不可用（${status}）。`, 502);
}

export function jsonError(error: unknown) {
  const portalError =
    error instanceof PortalError
      ? error
      : new PortalError('暂时无法处理请求，请稍后再试。', 500);
  const headers = portalError.status === 401
    ? { 'WWW-Authenticate': 'Basic realm="Wenlan Review", charset="UTF-8"' }
    : undefined;
  return Response.json(
    { ok: false, error: portalError.message },
    { status: portalError.status, headers },
  );
}

function hasValidBasicAuth(request: Request, expectedUser: string, expectedPassword: string) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Basic ')) return false;
  try {
    const decoded = atob(authorization.slice(6));
    const separator = decoded.indexOf(':');
    if (separator < 0) return false;
    return safeEqual(decoded.slice(0, separator), expectedUser)
      && safeEqual(decoded.slice(separator + 1), expectedPassword);
  } catch {
    return false;
  }
}

function safeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function cleanText(value: unknown, min: number, max: number, label: string) {
  if (typeof value !== 'string') {
    throw new PortalError(`请填写${label}。`);
  }
  const text = value.trim();
  if (text.length < min || text.length > max) {
    throw new PortalError(`${label}长度应为 ${min}–${max} 个字符。`);
  }
  return text;
}

function optionalText(value: unknown, max: number, label: string) {
  if (value == null || value === '') return '';
  if (typeof value !== 'string') {
    throw new PortalError(`${label}格式不正确。`);
  }
  const text = value.trim();
  if (text.length > max) {
    throw new PortalError(`${label}不能超过 ${max} 个字符。`);
  }
  return text;
}

function boundedInteger(value: unknown, min: number, max: number, label: string) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new PortalError(`${label}必须在 ${min}–${max} 之间。`);
  }
  return number;
}

function rejectPersonalIdentifiers(values: string[]) {
  const combined = values.join('\n');
  const email = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i;
  const phone = /(?<!\d)1[3-9]\d{9}(?!\d)/;
  const identity = /(?<!\d)\d{17}[\dXx](?!\d)/;
  if (email.test(combined) || phone.test(combined) || identity.test(combined)) {
    throw new PortalError('请删除邮箱、手机号、身份证号等个人信息后再提交。');
  }
}
