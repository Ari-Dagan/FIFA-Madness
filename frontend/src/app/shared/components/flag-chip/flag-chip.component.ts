import { Component, input } from '@angular/core';

@Component({
  selector: 'app-flag-chip',
  standalone: true,
  template: `
    <span class="flag-chip" [class.bold]="bold()">
      <span class="flag" aria-hidden="true">{{ flag() }}</span>
      <span class="name">{{ name() }}</span>
    </span>
  `,
  styles: [`
    .flag-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-family: 'Inter', sans-serif;
      font-size: 0.875rem;
      color: inherit;
      white-space: nowrap;
    }
    .flag { font-size: 1.1em; line-height: 1; }
    .name { font-weight: 400; letter-spacing: 0.1px; }
    .bold .name { font-weight: 700; }
  `],
})
export class FlagChipComponent {
  flag = input<string>('');
  name = input<string>('');
  bold = input<boolean>(false);
}
