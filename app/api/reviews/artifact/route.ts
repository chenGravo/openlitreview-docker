import {
  githubError,
  githubRequest,
  jsonError,
  repositoryConfig,
  requirePortalUser,
} from '@/lib/github';

type Artifact = {
  id: number;
  name: string;
  expired: boolean;
};

export async function GET(request: Request) {
  try {
    requirePortalUser(request);
    const url = new URL(request.url);
    const runId = Number(url.searchParams.get('runId'));
    const artifactId = Number(url.searchParams.get('artifactId'));
    if (
      !Number.isSafeInteger(runId) ||
      !Number.isSafeInteger(artifactId) ||
      runId <= 0 ||
      artifactId <= 0
    ) {
      return Response.json({ ok: false, error: '下载地址无效。' }, { status: 400 });
    }
    const config = repositoryConfig();
    const listResponse = await githubRequest(
      `/repos/${config.owner}/${config.repository}/actions/runs/${runId}/artifacts`,
    );
    if (!listResponse.ok) throw githubError(listResponse.status);
    const payload = (await listResponse.json()) as { artifacts?: Artifact[] };
    const artifact = (payload.artifacts || []).find(
      (item) =>
        item.id === artifactId &&
        !item.expired &&
        (item.name.startsWith('manuscript-') ||
          item.name.startsWith('private-audit-')),
    );
    if (!artifact) {
      return Response.json({ ok: false, error: '成果已过期或不存在。' }, { status: 404 });
    }
    const redirect = await githubRequest(
      `/repos/${config.owner}/${config.repository}/actions/artifacts/${artifactId}/zip`,
      { redirect: 'manual' },
    );
    if (redirect.status !== 302) throw githubError(redirect.status);
    const location = redirect.headers.get('location');
    if (!location) throw new Error('Missing artifact location');
    const archive = await fetch(location, { redirect: 'follow', cache: 'no-store' });
    if (!archive.ok || !archive.body) throw githubError(archive.status);
    const filename = `${artifact.name.replace(/[^a-zA-Z0-9._-]/g, '-')}.zip`;
    return new Response(archive.body, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
