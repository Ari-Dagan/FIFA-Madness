import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Outcome } from '../../../core/models/index';
import { getFlagUrl, teamDisplayName } from '../../../core/utils/country-flags';

@Component({
  selector: 'app-pick-toggle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pick-toggle.component.html',
  styleUrl: './pick-toggle.component.scss',
})
export class PickToggleComponent {
  homeTeam = input<string>('Home');
  awayTeam = input<string>('Away');
  homeFlag = input<string>('');
  awayFlag = input<string>('');
  value = input<Outcome | null>(null);
  disabled = input<boolean>(false);
  result = input<Outcome | null>(null);

  pickChange = output<Outcome>();

  isGraded = computed(() => this.result() !== null);
  homeFlagUrl = computed(() => getFlagUrl(this.homeTeam()));
  awayFlagUrl = computed(() => getFlagUrl(this.awayTeam()));
  homeDisplayName = computed(() => teamDisplayName(this.homeTeam()));
  awayDisplayName = computed(() => teamDisplayName(this.awayTeam()));

  select(outcome: Outcome): void {
    if (this.disabled()) return;
    this.pickChange.emit(outcome);
  }

  buttonState(outcome: Outcome): 'correct' | 'wrong' | 'selected' | 'unselected' | 'graded-other' {
    const val = this.value();
    const res = this.result();
    const isSelected = val === outcome;

    if (res !== null) {
      if (isSelected && res === outcome) return 'correct';
      if (isSelected && res !== outcome) return 'wrong';
      if (!isSelected && res === outcome) return 'graded-other';
      return 'unselected';
    }
    return isSelected ? 'selected' : 'unselected';
  }
}
