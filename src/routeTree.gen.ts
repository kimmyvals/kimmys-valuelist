/* eslint-disable */
// @ts-nocheck
import { Route as rootRouteImport } from './routes/__root'
import { Route as ResetPasswordRouteImport } from './routes/reset-password'
import { Route as InboxRouteImport } from './routes/inbox'
import { Route as CalculatorRouteImport } from './routes/calculator'
import { Route as IndexRouteImport } from './routes/index'
import { Route as GamesIndexRouteImport } from './routes/games.index'
import { Route as GamesSnowfallRouteImport } from './routes/games.snowfall'
import { Route as GamesMemorizeRouteImport } from './routes/games.memorize'
import { Route as GamesMarketRouteImport } from './routes/games.market'
import { Route as GamesDailyRouteImport } from './routes/games.daily'

const ResetPasswordRoute = ResetPasswordRouteImport.update({ id: '/reset-password', path: '/reset-password', getParentRoute: () => rootRouteImport } as any)
const InboxRoute = InboxRouteImport.update({ id: '/inbox', path: '/inbox', getParentRoute: () => rootRouteImport } as any)
const CalculatorRoute = CalculatorRouteImport.update({ id: '/calculator', path: '/calculator', getParentRoute: () => rootRouteImport } as any)
const IndexRoute = IndexRouteImport.update({ id: '/', path: '/', getParentRoute: () => rootRouteImport } as any)
const GamesIndexRoute = GamesIndexRouteImport.update({ id: '/games/', path: '/games/', getParentRoute: () => rootRouteImport } as any)
const GamesSnowfallRoute = GamesSnowfallRouteImport.update({ id: '/games/snowfall', path: '/games/snowfall', getParentRoute: () => rootRouteImport } as any)
const GamesMemorizeRoute = GamesMemorizeRouteImport.update({ id: '/games/memorize', path: '/games/memorize', getParentRoute: () => rootRouteImport } as any)
const GamesMarketRoute = GamesMarketRouteImport.update({ id: '/games/market', path: '/games/market', getParentRoute: () => rootRouteImport } as any)
const GamesDailyRoute = GamesDailyRouteImport.update({ id: '/games/daily', path: '/games/daily', getParentRoute: () => rootRouteImport } as any)

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute; '/calculator': typeof CalculatorRoute; '/inbox': typeof InboxRoute
  '/reset-password': typeof ResetPasswordRoute; '/games/daily': typeof GamesDailyRoute
  '/games/market': typeof GamesMarketRoute; '/games/memorize': typeof GamesMemorizeRoute
  '/games/snowfall': typeof GamesSnowfallRoute; '/games/': typeof GamesIndexRoute
}
export interface FileRoutesByTo {
  '/': typeof IndexRoute; '/calculator': typeof CalculatorRoute; '/inbox': typeof InboxRoute
  '/reset-password': typeof ResetPasswordRoute; '/games/daily': typeof GamesDailyRoute
  '/games/market': typeof GamesMarketRoute; '/games/memorize': typeof GamesMemorizeRoute
  '/games/snowfall': typeof GamesSnowfallRoute; '/games': typeof GamesIndexRoute
}
export interface FileRoutesById {
  __root__: typeof rootRouteImport; '/': typeof IndexRoute; '/calculator': typeof CalculatorRoute
  '/inbox': typeof InboxRoute; '/reset-password': typeof ResetPasswordRoute
  '/games/daily': typeof GamesDailyRoute; '/games/market': typeof GamesMarketRoute
  '/games/memorize': typeof GamesMemorizeRoute; '/games/snowfall': typeof GamesSnowfallRoute
  '/games/': typeof GamesIndexRoute
}
export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths: '/' | '/calculator' | '/inbox' | '/reset-password' | '/games/daily' | '/games/market' | '/games/memorize' | '/games/snowfall' | '/games/'
  fileRoutesByTo: FileRoutesByTo
  to: '/' | '/calculator' | '/inbox' | '/reset-password' | '/games/daily' | '/games/market' | '/games/memorize' | '/games/snowfall' | '/games'
  id: '__root__' | '/' | '/calculator' | '/inbox' | '/reset-password' | '/games/daily' | '/games/market' | '/games/memorize' | '/games/snowfall' | '/games/'
  fileRoutesById: FileRoutesById
}
export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute; CalculatorRoute: typeof CalculatorRoute
  InboxRoute: typeof InboxRoute; ResetPasswordRoute: typeof ResetPasswordRoute
  GamesDailyRoute: typeof GamesDailyRoute; GamesMarketRoute: typeof GamesMarketRoute
  GamesMemorizeRoute: typeof GamesMemorizeRoute; GamesSnowfallRoute: typeof GamesSnowfallRoute
  GamesIndexRoute: typeof GamesIndexRoute
}

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/reset-password': { id: '/reset-password'; path: '/reset-password'; fullPath: '/reset-password'; preLoaderRoute: typeof ResetPasswordRouteImport; parentRoute: typeof rootRouteImport }
    '/inbox': { id: '/inbox'; path: '/inbox'; fullPath: '/inbox'; preLoaderRoute: typeof InboxRouteImport; parentRoute: typeof rootRouteImport }
    '/calculator': { id: '/calculator'; path: '/calculator'; fullPath: '/calculator'; preLoaderRoute: typeof CalculatorRouteImport; parentRoute: typeof rootRouteImport }
    '/': { id: '/'; path: '/'; fullPath: '/'; preLoaderRoute: typeof IndexRouteImport; parentRoute: typeof rootRouteImport }
    '/games/': { id: '/games/'; path: '/games'; fullPath: '/games/'; preLoaderRoute: typeof GamesIndexRouteImport; parentRoute: typeof rootRouteImport }
    '/games/snowfall': { id: '/games/snowfall'; path: '/games/snowfall'; fullPath: '/games/snowfall'; preLoaderRoute: typeof GamesSnowfallRouteImport; parentRoute: typeof rootRouteImport }
    '/games/memorize': { id: '/games/memorize'; path: '/games/memorize'; fullPath: '/games/memorize'; preLoaderRoute: typeof GamesMemorizeRouteImport; parentRoute: typeof rootRouteImport }
    '/games/market': { id: '/games/market'; path: '/games/market'; fullPath: '/games/market'; preLoaderRoute: typeof GamesMarketRouteImport; parentRoute: typeof rootRouteImport }
    '/games/daily': { id: '/games/daily'; path: '/games/daily'; fullPath: '/games/daily'; preLoaderRoute: typeof GamesDailyRouteImport; parentRoute: typeof rootRouteImport }
  }
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute, CalculatorRoute, InboxRoute, ResetPasswordRoute,
  GamesDailyRoute, GamesMarketRoute, GamesMemorizeRoute, GamesSnowfallRoute,
  GamesIndexRoute,
}
export const routeTree = rootRouteImport._addFileChildren(rootRouteChildren)._addFileTypes<FileRouteTypes>()
