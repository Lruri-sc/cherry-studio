import { BaseService } from '@main/core/lifecycle'
import { LATEST_PRIVACY_POLICY_VERSION } from '@shared/utils/constants'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Exercises the data-collection preference and reconcile-after-settle convergence. The reachable
 * race lives in async deactivation: a re-enable that lands while client.destroy() is pending must
 * still be honoured.
 */

const { mockTrackAppLaunch, mockTrackTokenUsage, mockTrackAppUpdate, mockDestroy, MockAnalyticsClient, captured } =
  vi.hoisted(() => {
    const trackAppLaunch = vi.fn()
    const trackTokenUsage = vi.fn()
    const trackAppUpdate = vi.fn()
    const destroy = vi.fn()
    return {
      mockTrackAppLaunch: trackAppLaunch,
      mockTrackTokenUsage: trackTokenUsage,
      mockTrackAppUpdate: trackAppUpdate,
      mockDestroy: destroy,
      MockAnalyticsClient: vi.fn(() => ({
        trackAppLaunch,
        trackTokenUsage,
        trackAppUpdate,
        destroy
      })),
      captured: {
        prefHandlers: {} as Record<string, (value: never) => void>,
        preferenceValues: {} as Record<string, boolean | string>
      }
    }
  })

vi.mock('@cherrystudio/analytics-client', () => ({
  AnalyticsClient: MockAnalyticsClient
}))

vi.mock('@main/utils/systemInfo', () => ({
  getClientId: vi.fn(() => 'test-client-id'),
  generateUserAgent: vi.fn(() => 'test-user-agent')
}))

vi.mock('@application', async () => {
  const { mockApplicationFactory } = await import('@test-mocks/main/application')
  return mockApplicationFactory({
    PreferenceService: {
      subscribeChange: vi.fn((key: string, cb: (value: never) => void) => {
        captured.prefHandlers[key] = cb
        return () => {}
      }),
      get: vi.fn((key: string) => captured.preferenceValues[key])
    }
  })
})

import { AnalyticsService } from '../AnalyticsService'

function changePreference(key: string, value: boolean | string): void {
  captured.preferenceValues[key] = value
  captured.prefHandlers[key]?.(value as never)
}

beforeEach(() => {
  BaseService.resetInstances()
  for (const key of Object.keys(captured.prefHandlers)) {
    delete captured.prefHandlers[key]
  }
  captured.preferenceValues['app.privacy.data_collection.enabled'] = true
  captured.preferenceValues['app.privacy.policy_version'] = LATEST_PRIVACY_POLICY_VERSION
  mockTrackAppLaunch.mockReset()
  mockTrackTokenUsage.mockReset()
  mockTrackAppUpdate.mockReset()
  mockDestroy.mockReset()
  MockAnalyticsClient.mockClear()
})

describe('AnalyticsService data collection preference', () => {
  it('does not activate before the latest privacy policy is accepted', async () => {
    captured.preferenceValues['app.privacy.policy_version'] = ''

    const service = new AnalyticsService()
    await service._doInit()

    expect(service.isActivated).toBe(false)
    expect(MockAnalyticsClient).not.toHaveBeenCalled()
    expect(captured.prefHandlers['app.privacy.policy_version']).toBeDefined()

    await service.trackAppUpdate()
    expect(mockTrackAppUpdate).not.toHaveBeenCalled()
  })

  it('never activates, even with data collection on and the latest policy accepted (fork)', async () => {
    const service = new AnalyticsService()
    await service._doInit()

    changePreference('app.privacy.data_collection.enabled', true)
    changePreference('app.privacy.policy_version', LATEST_PRIVACY_POLICY_VERSION)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(service.isActivated).toBe(false)
    expect(MockAnalyticsClient).not.toHaveBeenCalled()
    service.trackTokenUsage({ provider: 'p', model: 'm', input_tokens: 1, output_tokens: 1 })
    await service.trackAppUpdate()
    expect(mockTrackTokenUsage).not.toHaveBeenCalled()
    expect(mockTrackAppUpdate).not.toHaveBeenCalled()
  })
})
