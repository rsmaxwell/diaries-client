// Generated from the 0024 Phase 1 MQTT capture by export-client-fixtures.cjs.
// Test fixtures only; source capture and SHA-256 manifest are in parent change-control.
export const fileRpcBaseline = [
  {
    "caseId": "list-empty-root",
    "function": "listFiles",
    "auth": "editor",
    "status": {
      "code": 200,
      "message": "ok"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": {
      "subdir": "",
      "items": []
    },
    "payloadFormat": "json"
  },
  {
    "caseId": "list-empty-nested",
    "function": "listFiles",
    "auth": "editor",
    "status": {
      "code": 200,
      "message": "ok"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": {
      "subdir": "alpha\\nested space",
      "items": []
    },
    "payloadFormat": "json"
  },
  {
    "caseId": "upload-image-root",
    "function": "uploadFile",
    "auth": "editor",
    "status": {
      "code": 200,
      "message": "ok"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": {
      "name": "plain.png",
      "path": "<FILES_ROOT>\\plain.png",
      "url": "/files/plain.png",
      "subdir": "",
      "size": 68
    },
    "payloadFormat": "json"
  },
  {
    "caseId": "upload-generic-root",
    "function": "uploadFile",
    "auth": "editor",
    "status": {
      "code": 200,
      "message": "ok"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": {
      "name": "generic.bin",
      "path": "<FILES_ROOT>\\generic.bin",
      "url": "/files/generic.bin",
      "subdir": "",
      "size": 28
    },
    "payloadFormat": "json"
  },
  {
    "caseId": "upload-image-octet-nested",
    "function": "uploadFile",
    "auth": "editor",
    "status": {
      "code": 200,
      "message": "ok"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": {
      "name": "image space.png",
      "path": "<FILES_ROOT>\\alpha\\nested space\\image space.png",
      "url": "/files/alpha\\nested space/image space.png",
      "subdir": "alpha\\nested space",
      "size": 68
    },
    "payloadFormat": "json"
  },
  {
    "caseId": "upload-image-date",
    "function": "uploadFile",
    "auth": "editor",
    "status": {
      "code": 200,
      "message": "ok"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": {
      "name": "dated.jpg",
      "path": "<FILES_ROOT>\\dated.jpg",
      "url": "/files/dated.jpg",
      "subdir": "",
      "size": 687
    },
    "payloadFormat": "json"
  },
  {
    "caseId": "upload-duplicate",
    "function": "uploadFile",
    "auth": "editor",
    "status": {
      "code": 409,
      "message": "conflict"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": "File already exists: plain.png",
    "payloadFormat": "json"
  },
  {
    "caseId": "upload-overwrite-generic",
    "function": "uploadFile",
    "auth": "editor",
    "status": {
      "code": 200,
      "message": "ok"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": {
      "name": "generic.bin",
      "path": "<FILES_ROOT>\\generic.bin",
      "url": "/files/generic.bin",
      "subdir": "",
      "size": 28
    },
    "payloadFormat": "json"
  },
  {
    "caseId": "upload-invalid-subdir",
    "function": "uploadFile",
    "auth": "editor",
    "status": {
      "code": 400,
      "message": "bad request"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": "Invalid 'subdir'.",
    "payloadFormat": "json"
  },
  {
    "caseId": "upload-invalid-name",
    "function": "uploadFile",
    "auth": "editor",
    "status": {
      "code": 400,
      "message": "bad request"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": "Invalid 'name'.",
    "payloadFormat": "json"
  },
  {
    "caseId": "upload-size-mismatch",
    "function": "uploadFile",
    "auth": "editor",
    "status": {
      "code": 500,
      "message": "internal error"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": "java.lang.ClassNotFoundException: Provider for jakarta.ws.rs.ext.RuntimeDelegate cannot be found",
    "payloadFormat": "json"
  },
  {
    "caseId": "upload-hash-mismatch",
    "function": "uploadFile",
    "auth": "editor",
    "status": {
      "code": 500,
      "message": "internal error"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": "java.lang.ClassNotFoundException: Provider for jakarta.ws.rs.ext.RuntimeDelegate cannot be found",
    "payloadFormat": "json"
  },
  {
    "caseId": "upload-unsupported-type",
    "function": "uploadFile",
    "auth": "editor",
    "status": {
      "code": 500,
      "message": "internal error"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": "java.lang.ClassNotFoundException: Provider for jakarta.ws.rs.ext.RuntimeDelegate cannot be found",
    "payloadFormat": "json"
  },
  {
    "caseId": "list-populated-root",
    "function": "listFiles",
    "auth": "editor",
    "status": {
      "code": 200,
      "message": "ok"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": {
      "subdir": "",
      "items": [
        {
          "name": "alpha",
          "size": 0,
          "mtime": 1704164645000,
          "dir": true
        },
        {
          "name": "empty",
          "size": 0,
          "mtime": 1704164645000,
          "dir": true
        },
        {
          "name": "zeta",
          "size": 0,
          "mtime": 1704164645000,
          "dir": true
        },
        {
          "name": "dated.jpg",
          "url": "/files/dated.jpg",
          "size": 687,
          "mtime": 1704164646000,
          "dateTaken": 1577934245000,
          "dir": false
        },
        {
          "name": "plain.png",
          "url": "/files/plain.png",
          "size": 68,
          "mtime": 1704164645000,
          "dir": false
        }
      ]
    },
    "payloadFormat": "json"
  },
  {
    "caseId": "list-populated-nested",
    "function": "listFiles",
    "auth": "editor",
    "status": {
      "code": 200,
      "message": "ok"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": {
      "subdir": "alpha\\nested space",
      "items": [
        {
          "name": "image space.png",
          "url": "/files/alpha/nested%20space/image%20space.png",
          "size": 68,
          "mtime": 1704164645000,
          "dir": false
        }
      ]
    },
    "payloadFormat": "json"
  },
  {
    "caseId": "list-missing-directory",
    "function": "listFiles",
    "auth": "editor",
    "status": {
      "code": 500,
      "message": "internal error"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": "<FILES_ROOT>\\does-not-exist",
    "payloadFormat": "json"
  },
  {
    "caseId": "list-invalid-subdir",
    "function": "listFiles",
    "auth": "editor",
    "status": {
      "code": 400,
      "message": "bad request"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": "Invalid 'subdir'.",
    "payloadFormat": "json"
  },
  {
    "caseId": "delete-image-existing",
    "function": "deleteFile",
    "auth": "editor",
    "status": {
      "code": 200,
      "message": "ok"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": {
      "subdir": "",
      "path": "<FILES_ROOT>\\plain.png",
      "name": "plain.png"
    },
    "payloadFormat": "json"
  },
  {
    "caseId": "delete-image-missing",
    "function": "deleteFile",
    "auth": "editor",
    "status": {
      "code": 200,
      "message": "ok"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": {
      "subdir": "",
      "path": "<FILES_ROOT>\\plain.png",
      "name": "plain.png"
    },
    "payloadFormat": "json"
  },
  {
    "caseId": "delete-generic-existing",
    "function": "deleteFile",
    "auth": "editor",
    "status": {
      "code": 200,
      "message": "ok"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": {
      "subdir": "",
      "path": "<FILES_ROOT>\\generic.bin",
      "name": "generic.bin"
    },
    "payloadFormat": "json"
  },
  {
    "caseId": "delete-generic-missing",
    "function": "deleteFile",
    "auth": "editor",
    "status": {
      "code": 200,
      "message": "ok"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": {
      "subdir": "",
      "path": "<FILES_ROOT>\\generic.bin",
      "name": "generic.bin"
    },
    "payloadFormat": "json"
  },
  {
    "caseId": "delete-image-nested",
    "function": "deleteFile",
    "auth": "editor",
    "status": {
      "code": 200,
      "message": "ok"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": {
      "subdir": "alpha\\nested space",
      "path": "<FILES_ROOT>\\alpha\\nested space\\image space.png",
      "name": "image space.png"
    },
    "payloadFormat": "json"
  },
  {
    "caseId": "delete-invalid-name",
    "function": "deleteFile",
    "auth": "editor",
    "status": {
      "code": 400,
      "message": "bad request"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": "Invalid 'name'.",
    "payloadFormat": "json"
  },
  {
    "caseId": "delete-invalid-subdir",
    "function": "deleteFile",
    "auth": "editor",
    "status": {
      "code": 400,
      "message": "bad request"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": "Invalid 'subdir'.",
    "payloadFormat": "json"
  },
  {
    "caseId": "upload-auth-missing",
    "function": "uploadFile",
    "auth": "missing",
    "status": {
      "code": 401,
      "message": "unauthorized"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": "accessToken not found'",
    "payloadFormat": "json"
  },
  {
    "caseId": "list-auth-missing",
    "function": "listFiles",
    "auth": "missing",
    "status": {
      "code": 401,
      "message": "unauthorized"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": "accessToken not found'",
    "payloadFormat": "json"
  },
  {
    "caseId": "delete-auth-missing",
    "function": "deleteFile",
    "auth": "missing",
    "status": {
      "code": 401,
      "message": "unauthorized"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": "accessToken not found'",
    "payloadFormat": "json"
  },
  {
    "caseId": "upload-auth-invalid",
    "function": "uploadFile",
    "auth": "invalid",
    "status": {
      "code": 500,
      "message": "internal error"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": "Invalid compact JWT string: Compact JWSs must contain exactly 2 period characters, and compact JWEs must contain exactly 4.  Found: 0",
    "payloadFormat": "json"
  },
  {
    "caseId": "list-auth-invalid",
    "function": "listFiles",
    "auth": "invalid",
    "status": {
      "code": 500,
      "message": "internal error"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": "Invalid compact JWT string: Compact JWSs must contain exactly 2 period characters, and compact JWEs must contain exactly 4.  Found: 0",
    "payloadFormat": "json"
  },
  {
    "caseId": "delete-auth-invalid",
    "function": "deleteFile",
    "auth": "invalid",
    "status": {
      "code": 500,
      "message": "internal error"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": "Invalid compact JWT string: Compact JWSs must contain exactly 2 period characters, and compact JWEs must contain exactly 4.  Found: 0",
    "payloadFormat": "json"
  },
  {
    "caseId": "upload-auth-reader",
    "function": "uploadFile",
    "auth": "reader",
    "status": {
      "code": 401,
      "message": "unauthorized"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": "insufficient role",
    "payloadFormat": "json"
  },
  {
    "caseId": "list-auth-reader",
    "function": "listFiles",
    "auth": "reader",
    "status": {
      "code": 401,
      "message": "unauthorized"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": "insufficient role",
    "payloadFormat": "json"
  },
  {
    "caseId": "delete-auth-reader",
    "function": "deleteFile",
    "auth": "reader",
    "status": {
      "code": 401,
      "message": "unauthorized"
    },
    "responseQos": 1,
    "responseRetain": false,
    "payload": "insufficient role",
    "payloadFormat": "json"
  }
];
