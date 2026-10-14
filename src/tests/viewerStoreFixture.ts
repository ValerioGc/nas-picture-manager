import { useViewerStore } from '@/stores/viewerStore';
import { imageDocument } from '@tests/fixtures';

export function readyViewer(name = 'photo.png') {
  const viewer = useViewerStore();
  viewer.entries = [{ id: 0, name }];
  viewer.info = imageDocument(name).info;
  viewer.preview = 'blob:image';
  return viewer;
}
