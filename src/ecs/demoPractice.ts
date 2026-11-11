import { practiceTopic } from '../math/practiceTopics';
import type { SteamAppRole } from '../platform/desktop';

const demoTopicIds = new Set([
  ...['add', 'subtract'].flatMap(function(operation) {
    return Array.from({ length: 8 }, function(_, index) { return `${operation}-make-${index + 3}`; });
  }),
  ...['multiply', 'divide'].flatMap(function(operation) {
    return Array.from({ length: 6 }, function(_, index) { return `${operation}-table-${index + 1}`; });
  }),
  'add-range-2-5', 'add-range-2-10', 'add-range-2-20',
  'subtract-range-1-4', 'subtract-range-1-9', 'subtract-range-0-20',
]);

export const isPracticeTopicAvailable = function(role: SteamAppRole, topicId: string): boolean {
  return practiceTopic(topicId) !== undefined && (role !== 'demo' || demoTopicIds.has(topicId));
};
