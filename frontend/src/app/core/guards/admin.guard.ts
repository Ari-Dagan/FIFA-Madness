import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PoolService } from '../services/pool.service';

export const adminGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const poolService = inject(PoolService);
  const router = inject(Router);

  const user = auth.currentUser();
  if (!user) return router.createUrlTree(['/auth/login']);

  const poolId = route.paramMap.get('poolId');
  if (!poolId) return router.createUrlTree(['/']);

  const isAdmin = await poolService.isAdmin(poolId, user.id);
  if (!isAdmin) return router.createUrlTree(['/pool', poolId, 'scores']);

  return true;
};
