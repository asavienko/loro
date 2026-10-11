// What the current test's app talks to: one fake API, replaced by each launch unless a test keeps it
// (a second device, a restart).
import { FakeApi } from './fakes/api';

export const world = { api: new FakeApi() };
