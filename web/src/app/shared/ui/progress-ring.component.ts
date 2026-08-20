import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-progress-ring',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" [attr.viewBox]="'0 0 ' + size() + ' ' + size()" class="block">
      <circle [attr.cx]="size()/2" [attr.cy]="size()/2" [attr.r]="radius()" fill="none"
        [attr.stroke]="trackColor()" [attr.stroke-width]="strokeWidth()"/>
      <circle [attr.cx]="size()/2" [attr.cy]="size()/2" [attr.r]="radius()" fill="none"
        [attr.stroke]="color()" [attr.stroke-width]="strokeWidth()" stroke-linecap="round"
        [attr.stroke-dasharray]="circumference() + ' ' + circumference()"
        [attr.stroke-dashoffset]="dashOffset()"
        [attr.transform]="'rotate(-90 ' + size()/2 + ' ' + size()/2 + ')'"
        class="transition-[stroke-dashoffset] duration-300 ease-in-out"/>
    </svg>
  `,
})
export class ProgressRingComponent {
  readonly progress = input(0);
  readonly size = input(48);
  readonly strokeWidth = input(4);
  readonly color = input('#047857');
  readonly trackColor = input('#e2e8f0');

  readonly radius = computed(() => (this.size() - this.strokeWidth()) / 2);
  readonly circumference = computed(() => 2 * Math.PI * this.radius());
  readonly dashOffset = computed(() =>
    this.circumference() * (1 - Math.min(100, Math.max(0, this.progress())) / 100));
}
