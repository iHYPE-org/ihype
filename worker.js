import openNextWorker from './.open-next/worker.js';

export { BucketCachePurge, DOQueueHandler, DOShardedTagCache } from './.open-next/worker.js';

export default {
  fetch(request, env, ctx) {
    const host = new URL(request.url).hostname;
    if (host === 'www.ihype.org') {
      const url = new URL(request.url);
      url.hostname = 'ihype.org';
      return Response.redirect(url.toString(), 308);
    }
    return openNextWorker.fetch(request, env, ctx);
  }
};
