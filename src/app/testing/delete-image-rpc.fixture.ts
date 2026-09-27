// Synthetic 0030 Step 2 contract examples, NOT captures from an implemented handler.
// Specification: parent change-control/in-progress/0030-.../RPC-CONTRACT.md.
export interface DeleteImageContractCase {
  caseId: string;
  auth: 'editor' | 'missing' | 'expired' | 'inactive' | 'viewer';
  request: { function: 'deleteImage'; args: Record<string, unknown> };
  status: { code: number; message: string };
  payload: { id: number; relativePath: string; deleted: true } | string;
}

const args = { subdir: 'diary-1830/images', name: 'img2221.jpg' };
const failure = (
  caseId: string, code: number, message: string, payload: string,
  requestArgs: Record<string, unknown> = args,
  auth: DeleteImageContractCase['auth'] = 'editor'
): DeleteImageContractCase => ({
  caseId, auth, request: { function: 'deleteImage', args: requestArgs },
  status: { code, message }, payload
});

export const deleteImageRpcContract: DeleteImageContractCase[] = [
  {
    caseId: 'delete-image-nested', auth: 'editor',
    request: { function: 'deleteImage', args },
    status: { code: 200, message: 'ok' },
    payload: { id: 85, relativePath: 'diary-1830/images/img2221.jpg', deleted: true }
  },
  {
    caseId: 'delete-image-root-default', auth: 'editor',
    request: { function: 'deleteImage', args: { name: 'image space.png' } },
    status: { code: 200, message: 'ok' },
    payload: { id: 86, relativePath: 'image space.png', deleted: true }
  },
  failure('missing-name', 400, 'bad request', "Invalid 'name'.", { subdir: 'diary-1830/images' }),
  failure('non-string-name', 400, 'bad request', "Invalid 'name'.", { ...args, name: 85 }),
  failure('null-subdir', 400, 'bad request', "Invalid 'subdir'.", { ...args, subdir: null }),
  failure('traversal', 400, 'bad request', 'Invalid image path.', { ...args, subdir: '../outside' }),
  failure('absolute-path', 400, 'bad request', 'Invalid image path.', { ...args, subdir: '/files' }),
  failure('reserved-staging', 400, 'bad request', 'Invalid image path.', { ...args, subdir: '.image-staging' }),
  failure('missing-token', 401, 'unauthorized', 'Access token required.', args, 'missing'),
  failure('expired-token', 401, 'unauthorized', 'JWT has expired', args, 'expired'),
  failure('inactive-account', 401, 'unauthorized', 'account is not active', args, 'inactive'),
  failure('insufficient-role', 401, 'unauthorized', 'insufficient role', args, 'viewer'),
  failure('not-catalogued-or-already-deleted', 404, 'not found', 'Image not found.'),
  failure('catalogued-file-missing', 409, 'conflict', 'Image file is missing.'),
  // Reserved for 0025: no ImageFragment lookup or enforcement is added by Step 2.
  failure('future-referenced-image', 409, 'conflict', 'Image is referenced.'),
  failure('database-or-filesystem-failure', 500, 'internal error', 'Image deletion failed.'),
  failure('post-commit-publication-failure', 500, 'internal error', 'Image deletion could not be fully confirmed.')
];
