


export interface Status {
    code: number
    message: string
};
export function isStatus(obj: any): obj is Status {
    return obj !== null &&
        typeof obj === 'object' &&
        'code' in obj && typeof obj.code === 'number' &&
        'message' in obj && typeof obj.message === 'string';
}

