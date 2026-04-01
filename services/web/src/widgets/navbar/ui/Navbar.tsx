import { LogoUrl } from '@/shared/assets';
import {
  Avatar,
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
  Navbar,
  NavbarItem,
  NavbarSection,
  NavbarSpacer,
} from '@/shared/ui';
import { ArrowRightStartOnRectangleIcon, Cog8ToothIcon, LightBulbIcon, ShieldCheckIcon, UserIcon } from '@heroicons/react/16/solid';
import { InboxIcon, MagnifyingGlassIcon } from '@heroicons/react/20/solid';

const navbar: React.FC = () => (
  <>
    <Navbar>
      <NavbarSpacer />
      <NavbarSection>
        <NavbarItem href="/search" aria-label="Search">
          <MagnifyingGlassIcon />
        </NavbarItem>
        <NavbarItem href="/inbox" aria-label="Inbox">
          <InboxIcon />
        </NavbarItem>

        <Dropdown>
          <DropdownButton as={NavbarItem}>
            <Avatar src={LogoUrl} alt="profile" square />
          </DropdownButton>
          <DropdownMenu className="min-w-64" anchor="bottom end">
            <DropdownItem href="/my-profile">
              <UserIcon />
              <DropdownLabel>My Profile</DropdownLabel>
            </DropdownItem>
            <DropdownItem href="/settings">
              <Cog8ToothIcon />
              <DropdownLabel>Settings</DropdownLabel>
            </DropdownItem>

            <DropdownDivider />

            <DropdownItem href="/private-policy">
              <ShieldCheckIcon />
              <DropdownLabel>Private Policy</DropdownLabel>
            </DropdownItem>

            <DropdownItem href="/share-feedback">
              <LightBulbIcon />
              <DropdownLabel>Share Feedback</DropdownLabel>
            </DropdownItem>

            <DropdownDivider />

            <DropdownItem href="/logout">
              <ArrowRightStartOnRectangleIcon />
              <DropdownLabel>Sign out</DropdownLabel>
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </NavbarSection>
    </Navbar>
  </>
);

export { navbar as Navbar };
