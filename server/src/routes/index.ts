import { Router } from "express";

import { authAdminRouter } from "../modules/auth/auth-admin.routes.js";
import { authRouter } from "../modules/auth/auth.routes.js";
import { catalogRouter } from "../modules/catalog/catalog.routes.js";
import { commerceRouter } from "../modules/commerce/commerce.routes.js";
import { connectorsRouter } from "../modules/connectors/connectors.routes.js";
import { importsRouter } from "../modules/imports/imports.routes.js";
import { monitoringRouter } from "../modules/monitoring/monitoring.routes.js";
import { notificationsRouter } from "../modules/notifications/notifications.routes.js";
import { scrapersRouter } from "../modules/scrapers/scrapers.routes.js";
import { systemLogsRouter } from "../modules/system-logs/system-logs.routes.js";
import { walletRouter } from "../modules/wallet/wallet.routes.js";
import { referralCommissionRouter } from "../modules/wallet/referral-commission.routes.js";
import { referralAdminRouter } from "../modules/referral-admin/referral-admin.routes.js";
import { shippingRouter } from "../modules/shipping/shipping.routes.js";

export const apiRouter = Router();

apiRouter.get("/health", (_request, response) => {
  response.status(200).json({
    status: "ok",
  });
});

apiRouter.use("/auth", authRouter);
apiRouter.use(authAdminRouter);
apiRouter.use(catalogRouter);
apiRouter.use(commerceRouter);
apiRouter.use(connectorsRouter);
apiRouter.use(importsRouter);
apiRouter.use(scrapersRouter);
apiRouter.use(monitoringRouter);
apiRouter.use(notificationsRouter);
apiRouter.use(systemLogsRouter);
apiRouter.use(walletRouter);
apiRouter.use(referralCommissionRouter);
apiRouter.use(referralAdminRouter);
apiRouter.use(shippingRouter);
