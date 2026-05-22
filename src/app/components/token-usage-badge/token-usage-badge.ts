import { Component, computed, input } from '@angular/core';

import { TokenUsageTotals } from '../../models';
import { formatTokenUsageLabel, hasTokenUsage } from '../../utils/format-token-usage';

@Component({
  selector: 'app-token-usage-badge',
  templateUrl: './token-usage-badge.html',
  styleUrl: './token-usage-badge.css',
})
export class TokenUsageBadge {
  readonly usage = input<TokenUsageTotals | null | undefined>(null);
  readonly live = input(false);

  protected readonly visible = computed(() => hasTokenUsage(this.usage()));
  protected readonly label = computed(() => formatTokenUsageLabel(this.usage()!));
}
