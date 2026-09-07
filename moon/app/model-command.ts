export type ModelConfig={key?:string;baseUrl?:string;model?:string};export class ModelError extends Error {constructor(message:string,public status=502){super(message);}}
