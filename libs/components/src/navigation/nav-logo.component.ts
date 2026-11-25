import { NgClass } from "@angular/common";
import { ChangeDetectionStrategy, Component, input, inject } from "@angular/core";
import { RouterLinkActive, RouterLink } from "@angular/router";

import { BitSvg, MultiwardenShield, MultiwardenSideNavLogo } from "@bitwarden/assets/svg";

import { SvgComponent } from "../svg/svg.component";

import { SideNavService } from "./side-nav.service";

@Component({
  selector: "bit-nav-logo",
  templateUrl: "./nav-logo.component.html",
  imports: [NgClass, RouterLinkActive, RouterLink, SvgComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-contents" },
})
export class NavLogoComponent {
  protected readonly sideNavService = inject(SideNavService);

  /**
   * The v2 side nav always displays this logo for the open state, regardless of `openIcon`.
   */
  // Multiwarden: own logo (upstream: SideNavLogo / SideNavLogoBeta by prereleaseBuild flag).
  protected readonly sideNavLogo = MultiwardenSideNavLogo;

  /**
   * Icon that is displayed when the side nav is closed
   *
   * @default MultiwardenShield
   */
  // Multiwarden: own mark (upstream: BitwardenShield).
  readonly closedIcon = input(MultiwardenShield);

  /**
   * Icon that is displayed when the side nav is open
   */
  readonly openIcon = input.required<BitSvg>();

  /**
   * Route to be passed to internal `routerLink`
   */
  readonly route = input.required<string | any[]>();

  /**
   * Passed to `attr.aria-label` and `attr.title`
   */
  readonly label = input.required<string>();
}
