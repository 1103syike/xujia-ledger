import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViewerImpactDisplay } from '../../../core/transactions/transaction-impact';

@Component({
  selector: 'app-consolidate-pick-row',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './consolidate-pick-row.component.html',
})
export class ConsolidatePickRowComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) impactDisplay!: ViewerImpactDisplay;
  @Input({ required: true }) listDate!: string;
  @Input() participantLine = '';
}
