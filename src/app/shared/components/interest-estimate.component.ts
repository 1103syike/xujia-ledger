import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  INTEREST_SCHEMES,
  interestTable,
  InterestScheme,
  InterestTableRow,
} from '../../core/utils/interest-calculator';

@Component({
  selector: 'app-interest-estimate',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './interest-estimate.component.html',

})
export class InterestEstimateComponent implements OnChanges {
  @Input({ required: true }) principal = 0;
  @Input() showPrincipal = true;

  schemes: InterestScheme[] = INTEREST_SCHEMES;
  table: InterestTableRow[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['principal']) {
      this.table = interestTable(this.principal);
    }
  }

  total(interest: number): number {
    return this.principal + interest;
  }
}
