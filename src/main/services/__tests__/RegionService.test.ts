import { beforeEach, describe, expect, it, vi } from 'vitest'

// Fork: the country comes from the OS locale, never from a geolocation service.
// `net.fetch` stays mocked only so the test can prove it is never touched.
const { netFetchMock, localeCountryMock } = vi.hoisted(() => ({
  netFetchMock: vi.fn(),
  localeCountryMock: vi.fn<() => string>()
}))

vi.mock('@logger', () => ({
  loggerService: {
    withContext: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })
  }
}))

vi.mock('electron', () => ({
  app: { getLocaleCountryCode: localeCountryMock },
  net: { fetch: netFetchMock }
}))

vi.mock('@application', async () => {
  const { mockApplicationFactory } = await import('@test-mocks/main/application')
  const result = mockApplicationFactory()
  const originalGet = result.application.get.getMockImplementation()!
  result.application.get.mockImplementation((name: string) => {
    if (name === 'ProxyService') return { appliedProxyKey: 'direct||' }
    return originalGet(name)
  })
  return result
})

import { MockMainCacheServiceUtils } from '@test-mocks/main/CacheService'

import { regionService } from '../RegionService'

describe('RegionService (offline)', () => {
  beforeEach(() => {
    MockMainCacheServiceUtils.resetMocks()
    netFetchMock.mockReset()
    localeCountryMock.mockReset()
  })

  it('never contacts a geolocation service', async () => {
    localeCountryMock.mockReturnValue('US')
    await regionService.getCountry()
    await regionService.isInChina()
    expect(netFetchMock).not.toHaveBeenCalled()
  })

  it('reads the country from the OS locale and caches it', async () => {
    localeCountryMock.mockReturnValue('US')
    await expect(regionService.getCountry()).resolves.toBe('US')
    await expect(regionService.getCountry()).resolves.toBe('US')
    expect(localeCountryMock).toHaveBeenCalledTimes(1)
  })

  it('reports isInChina case-insensitively', async () => {
    localeCountryMock.mockReturnValue('cn')
    await expect(regionService.isInChina()).resolves.toBe(true)

    MockMainCacheServiceUtils.resetMocks()
    localeCountryMock.mockReturnValue('JP')
    await expect(regionService.isInChina()).resolves.toBe(false)
  })

  it('falls back to CN when the locale has no country, without caching the fallback', async () => {
    localeCountryMock.mockReturnValueOnce('').mockReturnValueOnce('US')
    await expect(regionService.getCountry()).resolves.toBe('CN')
    // A later, valid answer must win — the fallback was not written to the cache.
    await expect(regionService.getCountry()).resolves.toBe('US')
  })
})
