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
  template: `
    <div *ngIf="principal > 0" class="interest-estimate">
      <p *ngIf="showPrincipal" class="caption-text">
        本金 NT$ {{ principal | number: '1.0-0' }}
        <span class="interest-estimate__hint">（利息計算僅供參考）</span>
      </p>
      <div class="interest-estimate__table-wrap">
        <table class="interest-estimate__table">
          <thead>
            <tr>
              <th scope="col">期間</th>
              <th
                *ngFor="let scheme of schemes"
                scope="col"
                [class.interest-estimate__th-shark]="scheme.id !== 'bank'"
              >
                {{ scheme.shortLabel }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of table">
              <th scope="row">{{ row.period.label }}</th>
              <td
                *ngFor="let scheme of schemes"
                [class.interest-estimate__td-shark]="scheme.id !== 'bank'"
              >
                <span class="interest-estimate__total">{{
                  total(row.amounts[scheme.id]) | number: '1.0-0'
                }}</span>
                <span class="interest-estimate__fee"
                  >(+{{ row.amounts[scheme.id] | number: '1.0-0' }})</span
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
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
