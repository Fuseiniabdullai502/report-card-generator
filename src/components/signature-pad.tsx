
'use client';

import React, { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from './ui/button';
import { Save, Trash2 } from 'lucide-react';

interface SignaturePadProps {
  onSave: (signature: string) => void;
  initialDataUrl?: string | null;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, initialDataUrl }) => {
  const sigPad = useRef<SignatureCanvas>(null);

  const handleClear = () => {
    sigPad.current?.clear();
  };

  const handleSave = () => {
    if (sigPad.current?.isEmpty()) {
      onSave(''); // Save as empty if cleared
    } else {
      const dataUrl = sigPad.current?.getTrimmedCanvas().toDataURL('image/png');
      if(dataUrl) {
        onSave(dataUrl);
      }
    }
  };

  React.useEffect(() => {
    // Set the initial signature if it exists
    if (initialDataUrl && sigPad.current) {
      sigPad.current.fromDataURL(initialDataUrl);
    }
  }, [initialDataUrl]);

  return (
    <div className="flex flex-col gap-4">
      <div className="border rounded-md bg-white">
        <SignatureCanvas
          ref={sigPad}
          penColor="black"
          canvasProps={{
            className: 'w-full h-48',
          }}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleClear}>
          <Trash2 className="mr-2 h-4 w-4" /> Clear
        </Button>
        <Button onClick={handleSave}>
          <Save className="mr-2 h-4 w-4" /> Save Signature
        </Button>
      </div>
    </div>
  );
};

export default SignaturePad;
