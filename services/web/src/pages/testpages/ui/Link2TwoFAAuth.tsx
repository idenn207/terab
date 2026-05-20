import { Button, Field, Input, Label } from '@/shared/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function Link2TwoFAAuth() {
  const [challendId, setChallengeId] = useState('');
  const navigation = useNavigate();

  return (
    <>
      <Field>
        <Label>Challenge ID</Label>
        <Input type="text" onChange={(e) => setChallengeId(e.target.value)} />
      </Field>
      <Button onClick={() => navigation(`/2fa/${challendId}`)}>이동</Button>
    </>
  );
}
