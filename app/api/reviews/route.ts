import {
  githubError,
  githubRequest,
  jsonError,
  repositoryConfig,
  requirePortalUser,
  requireSameOrigin,
  validateReviewRequest,
} from '@/lib/github';

type WorkflowRun = {
  id: number;
  display_title: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  path: string;
};

type Artifact = {
  id: number;
  name: string;
  expired: boolean;
};

export async function POST(request: Request) {
  try {
    requirePortalUser(request);
    requireSameOrigin(request);
    const input = validateReviewRequest(await request.json());
    const config = repositoryConfig();
    const response = await githubRequest(
      `/repos/${config.owner}/${config.repository}/actions/workflows/${config.workflow}/dispatches`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: config.ref,
          return_run_details: true,
          inputs: {
            input_mode: 'simple_form',
            title: input.title,
            research_question: input.researchQuestion,
            keywords: input.keywords || input.title,
            year_from: String(input.yearFrom),
            year_to: String(input.yearTo),
            target_characters: String(input.targetCharacters),
            additional_requirements: input.requirements,
            task_file: 'tasks/task.example.yml',
            confirmed: true,
          },
        }),
      },
    );
    if (!response.ok) throw githubError(response.status);
    if (response.status === 204) {
      return Response.json({
        ok: true,
        accepted: true,
        runId: null,
        status: 'queued',
      });
    }
    const payload = (await response.json()) as {
      workflow_run_id?: number;
      html_url?: string;
    };
    if (!payload.workflow_run_id) {
      return Response.json({
        ok: true,
        accepted: true,
        runId: null,
        status: 'queued',
      });
    }
    return Response.json({
      ok: true,
      runId: payload.workflow_run_id,
      status: 'queued',
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET(request: Request) {
  try {
    requirePortalUser(request);
    const url = new URL(request.url);
    const runId = url.searchParams.get('runId');
    return await (runId ? getRun(Number(runId)) : getRecentRuns());
  } catch (error) {
    return jsonError(error);
  }
}

async function getRun(runId: number) {
  if (!Number.isSafeInteger(runId) || runId <= 0) {
    throw new Error('Invalid run id');
  }
  const config = repositoryConfig();
  const response = await githubRequest(
    `/repos/${config.owner}/${config.repository}/actions/runs/${runId}`,
  );
  if (!response.ok) throw githubError(response.status);
  const run = (await response.json()) as WorkflowRun;
  if (!run.path.startsWith(`.github/workflows/${config.workflow}@`)) {
    throw new Error('Unexpected workflow');
  }
  const artifacts = run.status === 'completed' ? await getArtifacts(runId) : [];
  const failedStep = run.conclusion === 'failure' ? await getFailedStep(runId) : null;
  return Response.json({
    ok: true,
    run: {
      id: run.id,
      title: displayTitle(run.display_title),
      status: run.status,
      conclusion: run.conclusion,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
      failedStep,
      artifacts,
    },
  });
}

async function getRecentRuns() {
  const config = repositoryConfig();
  const response = await githubRequest(
    `/repos/${config.owner}/${config.repository}/actions/workflows/${config.workflow}/runs?event=workflow_dispatch&per_page=8`,
  );
  if (!response.ok) throw githubError(response.status);
  const payload = (await response.json()) as { workflow_runs?: WorkflowRun[] };
  return Response.json({
    ok: true,
    runs: (payload.workflow_runs || []).map((run) => ({
      id: run.id,
      title: displayTitle(run.display_title),
      status: run.status,
      conclusion: run.conclusion,
      createdAt: run.created_at,
    })),
  });
}

async function getArtifacts(runId: number) {
  const config = repositoryConfig();
  const response = await githubRequest(
    `/repos/${config.owner}/${config.repository}/actions/runs/${runId}/artifacts`,
  );
  if (!response.ok) throw githubError(response.status);
  const payload = (await response.json()) as { artifacts?: Artifact[] };
  return (payload.artifacts || [])
    .filter(
      (artifact) =>
        !artifact.expired &&
        (artifact.name.startsWith('manuscript-') ||
          artifact.name.startsWith('private-audit-')),
    )
    .map((artifact) => ({
      id: artifact.id,
      name: artifact.name,
      kind: artifact.name.startsWith('manuscript-') ? 'manuscript' : 'audit',
      downloadUrl: `/api/reviews/artifact?runId=${runId}&artifactId=${artifact.id}`,
    }));
}

async function getFailedStep(runId: number) {
  const config = repositoryConfig();
  const response = await githubRequest(
    `/repos/${config.owner}/${config.repository}/actions/runs/${runId}/jobs?filter=latest&per_page=100`,
  );
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    jobs?: Array<{
      name: string;
      conclusion: string | null;
      steps?: Array<{ name: string; conclusion: string | null }>;
    }>;
  };
  for (const job of payload.jobs || []) {
    const failed = job.steps?.find((step) => step.conclusion === 'failure');
    if (failed) return failed.name;
    if (job.conclusion === 'failure') return job.name;
  }
  return null;
}

function displayTitle(value: string) {
  return value.startsWith('综述｜') ? value.slice(3) : value;
}
