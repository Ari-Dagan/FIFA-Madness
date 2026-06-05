import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { AuthService } from '../../core/services/auth.service';
import { PoolService } from '../../core/services/pool.service';
import { Pool } from '../../core/models/index';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatCardModule, MatIconModule, MatChipsModule],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly poolService = inject(PoolService);
  private readonly router = inject(Router);

  readonly currentUser = this.auth.currentUser;
  readonly userPools = signal<Pool[]>([]);
  readonly loading = signal(false);

  async ngOnInit(): Promise<void> {
    const user = this.currentUser();
    if (user) {
      this.loading.set(true);
      try {
        const pools = await this.poolService.getUserPools(user.id);
        this.userPools.set(pools);
      } finally {
        this.loading.set(false);
      }
    }
  }

  goToPool(poolId: string): void {
    this.router.navigate(['/pool', poolId]);
  }
}
