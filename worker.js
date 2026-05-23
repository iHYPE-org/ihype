import openNextWorker from './.open-next/worker.js';

export { BucketCachePurge, DOQueueHandler, DOShardedTagCache } from './.open-next/worker.js';

export default {
  fetch(request, env, ctx) {
    return openNextWorker.fetch(request, env, ctx);
  }
};
