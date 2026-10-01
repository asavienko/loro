import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { ApiError } from '../api/client';
import { Attributes, log, metric, reportError, routeOf, setTelemetrySink, TelemetrySink } from './telemetry';

function recorder() {
  const seen: { kind: string; name: string; attributes: Attributes }[] = [];
  const sink: TelemetrySink = {
    log: (level, message, attributes) => seen.push({ kind: `log:${level}`, name: message, attributes }),
    exception: (error, attributes) => seen.push({ kind: 'exception', name: error instanceof Error ? error.message : String(error), attributes }),
    metric: (name, attributes) => seen.push({ kind: 'metric', name, attributes }),
  };
  setTelemetrySink(sink);
  return seen;
}

describe('telemetry', () => {
  afterEach(() => setTelemetrySink(null));

  it('sends nothing, and fails nothing, without a sink', () => {
    log.error('nobody hears this');
    metric('nothing', { n: 1 });
    reportError('save', new Error('disk'));
  });

  it('logs a failure and tracks it as an exception', () => {
    const seen = recorder();
    reportError('save', new TypeError('disk'), { result: 'unavailable' });
    assert.deepEqual(seen, [
      { kind: 'log:error', name: 'save failed', attributes: { where: 'save', error_name: 'TypeError', error_message: 'disk', result: 'unavailable' } },
      { kind: 'exception', name: 'disk', attributes: { where: 'save', error_name: 'TypeError', error_message: 'disk', result: 'unavailable' } },
    ]);
  });

  it('logs an API failure with its status and code, but not as an exception', () => {
    const seen = recorder();
    reportError('progress sync', new ApiError(0, 'OFFLINE', 'The server could not be reached'));
    reportError('progress sync', new ApiError(409, 'STALE_REVISION', 'Stale'));
    assert.deepEqual(
      seen.map((s) => s.kind),
      ['log:info', 'log:warn'],
    );
    assert.deepEqual(seen[0]?.attributes, {
      where: 'progress sync',
      error_name: 'ApiError',
      error_message: 'The server could not be reached',
      error_status: 0,
      error_code: 'OFFLINE',
    });
  });

  it('keeps a sink that throws from breaking the caller', () => {
    setTelemetrySink({
      log: () => {
        throw new Error('sink');
      },
      exception: () => {},
      metric: () => {},
    });
    log.warn('still fine');
  });

  it('names routes without their ids, codes or queries', () => {
    assert.equal(routeOf('/library/sets/set_8f2/songs'), '/library/sets/:id/songs');
    assert.equal(routeOf('/library/pack?target=es-ES'), '/library/pack');
    assert.equal(routeOf('/library/shared/kxqvbt'), '/library/shared/:id');
    assert.equal(routeOf('/library/saves/set/abc'), '/library/saves/:id/:id');
    assert.equal(routeOf('/library/covers/cover-1.json'), '/library/covers/:id');
    assert.equal(routeOf('/auth/google/start'), '/auth/google/start');
    assert.equal(routeOf('https://api.loro.app/v1/library/progress'), '/v1/library/progress');
  });
});
