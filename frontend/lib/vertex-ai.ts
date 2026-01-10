import { VertexAI } from '@google-cloud/vertexai';

// Initialize Vertex with your Cloud project and location
const project = process.env.GOOGLE_CLOUD_PROJECT || 'micpro';
const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

const vertex_ai = new VertexAI({ project: project, location: location });

export function getModel(modelName: string = 'gemini-1.5-flash-001') {
    return vertex_ai.getGenerativeModel({ model: modelName });
}
