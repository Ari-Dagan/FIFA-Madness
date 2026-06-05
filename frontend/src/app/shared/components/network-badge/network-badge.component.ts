import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-network-badge',
  standalone: true,
  template: `<span class="badge" [style.background]="bgColor()">{{ displayText() }}</span>`,
  styles: [`
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 700;
      font-family: 'Inter', sans-serif;
      letter-spacing: 0.5px;
      white-space: nowrap;
      text-transform: uppercase;
      line-height: 1.6;
      color: white;
    }
  `],
})
export class NetworkBadgeComponent {
  network = input<string>('');

  displayText = computed(() => {
    const n = this.network().trim().toUpperCase();
    return n || 'TBD';
  });

  bgColor = computed((): string => {
    const n = this.network().trim().toUpperCase();
    if (!n || n === 'TBD') return '#6b7280';
    if (n === 'FOX' || n === 'FOX/TUBI') return '#003087';
    if (n === 'FS1') return '#e87722';
    if (n === 'TUBI') return '#7b2fbe';
    if (n.startsWith('FOX')) return '#003087';
    if (n.includes('FS1')) return '#e87722';
    if (n.includes('TUBI')) return '#7b2fbe';
    return '#6b7280';
  });
}
