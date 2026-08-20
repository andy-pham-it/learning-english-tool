import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ProgressRingComponent } from './progress-ring.component';

describe('ProgressRingComponent', () => {
  let fixture: ComponentFixture<ProgressRingComponent>;
  let component: ProgressRingComponent;

  const offsetAttr = () =>
    fixture.debugElement.query(By.css('circle:last-of-type'))
      .nativeElement.getAttribute('stroke-dashoffset');

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ProgressRingComponent] }).compileComponents();
    fixture = TestBed.createComponent(ProgressRingComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('size', 48);
    fixture.componentRef.setInput('strokeWidth', 4);
    fixture.detectChanges();
  });

  const C = 2 * Math.PI * 22; // radius = (48-4)/2 = 22

  it('creates', () => expect(component).toBeTruthy());

  it('dashoffset = full circumference at 0%', () => {
    expect(component.dashOffset()).toBeCloseTo(C, 1);
  });

  it('dashoffset = half circumference at 50%', () => {
    fixture.componentRef.setInput('progress', 50);
    fixture.detectChanges();
    expect(component.dashOffset()).toBeCloseTo(C / 2, 1);
  });

  it('dashoffset = 0 at 100%', () => {
    fixture.componentRef.setInput('progress', 100);
    fixture.detectChanges();
    expect(component.dashOffset()).toBeCloseTo(0, 1);
  });

  it('clamps progress outside 0..100', () => {
    fixture.componentRef.setInput('progress', 150);
    fixture.detectChanges();
    expect(component.dashOffset()).toBeCloseTo(0, 1);
  });

  it('applies dashoffset to the SVG circle', () => {
    fixture.componentRef.setInput('progress', 50);
    fixture.detectChanges();
    expect(+offsetAttr()!).toBeCloseTo(C / 2, 1);
  });
});
