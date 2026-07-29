import type { ArtifactKind } from '../models.js';
import { ArtifactRepository } from '../repositories/artifactRepository.js';

export function createArtifact(input: {
  runId?: string;
  sessionId?: string;
  title: string;
  kind: ArtifactKind;
  content: string;
}) {
  return ArtifactRepository.create(input);
}

export function listArtifacts() {
  return ArtifactRepository.list();
}
